#!/usr/bin/env python3
"""Precompute plain-English briefs for the viewer (analyst sugar, NOT the scored reason).

- Input: the proof only (trace graph + official output + the names/amounts on the graph's own nodes).
- If XAI_API_KEY is set: ask Grok (xAI chat completions, temperature 0), cached by prompt hash.
  Otherwise: a deterministic template rendered from the same proof (source = "template").
- Every brief is fact-checked: each £ amount, record ID and proper name in it must appear in the proof.
  Failures are dropped and listed in data/briefs_rejected.json.
Output: viewer/data/briefs.json  {case_id: {"text", "source", "model"?}}

usage: python3 viewer/make_briefs.py [--limit N]   (demo cases + graph-ready cases, up to N per institution)
"""
import hashlib, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "viewer", "data")
INSTS = ["bank", "emoney", "investment", "payments_fx"]
MODEL = os.environ.get("XAI_MODEL", "grok-4")
CACHE = os.path.join(DATA, "briefs_cache.json")


def load_bundle(inst):
    txt = open(os.path.join(DATA, inst + ".js"), encoding="utf-8").read()
    return json.loads(txt[txt.index("] = ") + 4: txt.rstrip().rindex(";")])


def fmt(x):
    return "£{:,.2f}".format(x)


def proof_of(d):
    """The only material a brief may draw on."""
    tl = {t["id"]: t for t in d["timeline"]}
    nodes = []
    for n in d["trace"]["nodes"]:
        x = {"id": n["id"], "class": n.get("class") or n["type"], "label": n.get("label")}
        if n["id"] in tl:
            t = tl[n["id"]]
            x.update(amount=fmt(t["amt"]), direction=t["dir"], counterparty=t["cp"], date=t["at"][:10])
        nodes.append(x)
    return {"case": d["out"]["case_id"], "customer": d["customer"].get("name"),
            "verdict": d["out"]["verdict"], "reason_code": d["out"]["reason_code"],
            "official_reason": d["out"]["reason"], "evidence": d["out"]["evidence"],
            "nodes": nodes, "edges": [[e["from"], e.get("property") or e["rel"], e["to"]] for e in d["trace"]["edges"]],
            "facts": d["trace"]["facts"], "rules_fired": [[f["rule"], f["outcome"]] for f in d["trace"]["firings"]],
            "reconciliation": d["trace"]["reconciliation"], "list_resolution": d["trace"].get("list_resolution")}


def corpus(p):
    return json.dumps(p, ensure_ascii=False)


AMT = re.compile(r"£\s?[\d,]+(?:\.\d{2})?")
IDS = re.compile(r"\b[A-Z]{2,4}(?:-[A-Z]{1,3})?-?\d{2,}\b")
NAME = re.compile(r"\b([A-Z][a-z]+(?:\s+(?:&\s+)?[A-Z][a-z]+){1,3})\b")
VOCAB = {"Close", "Escalate", "Request", "The", "This", "A", "An", "No", "All", "Every", "Books", "One", "Two", "Three",
         "Under", "Because", "So", "It", "Its", "There", "None", "Nothing"}


def verify(text, p):
    c = corpus(p)
    cnum = set(re.sub(r"[£,\s]", "", a) for a in AMT.findall(c))
    for a in re.findall(r'"amount_gbp":\s*([\d.]+)|"(?:alerted|explained|unexplained|profile)_gbp":\s*([\d.]+)', c):
        v = a[0] or a[1]
        cnum.add("%.2f" % float(v))
    bad = []
    for a in AMT.findall(text):
        v = re.sub(r"[£,\s]", "", a)
        if v not in cnum and ("%.2f" % float(v)) not in cnum:
            bad.append(a)
    for i in IDS.findall(text):
        if i not in c:
            bad.append(i)
    for nm in NAME.findall(text):
        words = nm.split()
        if words[0] in VOCAB:
            nm = " ".join(words[1:])
            if len(nm.split()) < 2:
                continue
        if nm not in c:
            bad.append(nm)
    return bad


PLAIN = {
    "listed_person_controlled_counterparty_at_payment": "the listed person still controlled the payee when the money was paid",
    "officer_resigned_before_payment": "the register shows a resignation before the payment, which the control register overrides",
    "counterparty_dob_equals_list_dob": "the counterparty's date of birth equals the list entry's",
    "counterparty_dob_differs_from_list": "the counterparty's date of birth differs from the list entry's",
    "counterparty_address_differs_from_list": "the payee's address differs from the list entry's",
    "officer_birth_differs_from_list": "the officer's birth date differs from the list entry's",
}


def template(p):
    recs = p["reconciliation"]
    alerts = [n for n in p["nodes"] if n["class"] == "Alert"]
    rules = sorted(set(n["label"] for n in alerts))
    s = ["PROOF reviewed %d alert%s (%s) for %s." % (len(alerts), "" if len(alerts) == 1 else "s", " + ".join(rules),
                                                  p["customer"])]
    fired = p["rules_fired"]
    susp = [i for i, f in enumerate(fired) if re.match(r"S\d+_", f[0])]
    lists = p.get("list_resolution") or []
    srcs = lambda kinds: sorted(set(x for f in p["facts"] if f["kind"] in kinds for x in f["sources"]
                                    if not x.startswith(p["case"])))
    if susp:
        name = fired[susp[0]][0].split("_", 1)[1].replace("_", " ")
        src = sorted(set(x for f in p["facts"] for x in f["sources"]))[:4]
        s.append("The %s suspicion rule fired on %s, so the case is escalated as %s whatever the other documents show." % (
            name, ", ".join(src) if src else "the case records", p["reason_code"]))
    elif any(x.get("status") == "confirmed" for x in lists):
        ks = [f for f in p["facts"] if PLAIN.get(f["kind"])]
        s.append("The internal-list check is decisive: %s (%s), so the case is escalated as %s." % (
            "; ".join(PLAIN[f["kind"]] for f in ks[:2]), ", ".join(sorted(set(x for f in ks[:2] for x in f["sources"]))),
            p["reason_code"]))
    else:
        open_r = [r for r in recs if not r["cleared"]]
        done = [r for r in recs if r["cleared"]]
        for r in done[:2]:
            by = ", ".join(r.get("explained_by", [])[:3])
            s.append("%s (%s) is cleared%s." % (r["alert_id"], r["rule"], (" by " + by) if by else
                                                " within the declared profile and the rule's threshold"))
        if open_r:
            r = open_r[0]
            s.append("%s (%s) still has %s of %s unexplained, so PROOF asks for one specific document instead of "
                     "guessing (%s)." % (r["alert_id"], r["rule"], fmt(r["unexplained_gbp"]), fmt(r["alerted_gbp"]),
                                          p["reason_code"]))
        elif p["verdict"] == "CLOSE":
            s.append("Nothing is left unexplained and no suspicion rule fired, so the case closes as %s." % p["reason_code"])
        else:
            s.append("The verdict is %s (%s)." % (p["verdict"], p["reason_code"]))
    return " ".join(s[:4])


def ask_grok(p, key, cache):
    prompt = ("You explain a deterministic AML triage decision to an analyst. Use ONLY the JSON proof below. "
              "Write 2-3 plain-English sentences: what was alerted, what the evidence shows, and why the verdict follows. "
              "Copy every amount, ID and name exactly as written in the proof; do not add any other numbers, IDs or names. "
              "Do not change or second-guess the verdict.\n\nPROOF:\n" + json.dumps(p, ensure_ascii=False, sort_keys=True))
    h = hashlib.sha256((MODEL + prompt).encode()).hexdigest()
    if h in cache:
        return cache[h]
    req = urllib.request.Request("https://api.x.ai/v1/chat/completions", method="POST",
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                                 data=json.dumps({"model": MODEL, "temperature": 0,
                                                  "messages": [{"role": "user", "content": prompt}]}).encode())
    with urllib.request.urlopen(req, timeout=120) as r:
        text = json.loads(r.read())["choices"][0]["message"]["content"].strip()
    cache[h] = text
    return text


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 100
    key = os.environ.get("XAI_API_KEY")
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    out, rejected = {}, {}
    for inst in INSTS:
        if not os.path.exists(os.path.join(DATA, inst + ".js")):
            continue
        b = load_bundle(inst)
        ids = [x for x in b["demos"].values() if x] + [i for i in sorted(b["detail"]) if i not in b["demos"].values()]
        for cid in ids[:limit]:
            p = proof_of(b["detail"][cid])
            if key:
                try:
                    text, src = ask_grok(p, key, cache), "grok · temperature 0"
                except Exception as e:  # network/API failure: fall back, never block
                    text, src = template(p), "template (Grok call failed: %s)" % type(e).__name__
            else:
                text, src = template(p), "template (no XAI_API_KEY)"
            bad = verify(text, p)
            if bad:
                rejected[cid] = {"text": text, "unverified": bad, "source": src}
                continue
            out[cid] = {"text": text, "source": src}
    if key:
        json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True)
    json.dump(out, open(os.path.join(DATA, "briefs.json"), "w"), ensure_ascii=False, indent=0, sort_keys=True)
    json.dump(rejected, open(os.path.join(DATA, "briefs_rejected.json"), "w"), ensure_ascii=False, indent=1, sort_keys=True)
    print("briefs: %d verified, %d rejected, source=%s" % (len(out), len(rejected), "grok" if key else "template"))


if __name__ == "__main__":
    main()
