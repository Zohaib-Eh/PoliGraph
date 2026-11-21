#!/usr/bin/env python3
"""Build viewer/data/<inst>.js from the engine's outputs, traces and the evidence markdown.

usage: python3 viewer/build_data.py [--detail N] [--runs 5]
  - summary rows for every case (queue, counters)
  - full detail (graph, recon, docs, timeline) for N cases per institution (stratified by
    reason code, always including the pinned demo cases)
  - determinism fingerprint: re-runs system/run --runs times into a temp dir and hashes the outputs
"""
import hashlib, json, os, re, subprocess, sys, tempfile
from collections import defaultdict, OrderedDict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INSTS = ["bank", "emoney", "investment", "payments_fx"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
BOILER = {"due_diligence_summary", "proof_of_address", "contact_note"}


def arg(name, default):
    return int(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default


def jl(p):
    with open(p, encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def fmt(x):
    return "£{:,.2f}".format(x)


def dtxt(iso):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(iso or ""))
    return "%d %s %s" % (int(m.group(3)), MONTHS[int(m.group(2)) - 1], m.group(1)) if m else None


def fingerprint(inst, runs):
    hs = []
    with tempfile.TemporaryDirectory() as td:
        for k in range(runs):
            out = os.path.join(td, "%s.%d.jsonl" % (inst, k))
            subprocess.run([os.path.join(ROOT, "system", "run"), os.path.join(ROOT, "institutions", inst), out],
                           check=True, stderr=subprocess.DEVNULL)
            rows = jl(out)
            vc = hashlib.sha256("\n".join("%s|%s|%s" % (r["case_id"], r["verdict"], r["reason_code"])
                                          for r in rows).encode()).hexdigest()
            full = hashlib.sha256(open(out, "rb").read()).hexdigest()
            hs.append({"run": k + 1, "verdict_code_hash": vc[:12], "file_hash": full[:12]})
    return hs


def pick_demos(outs, traces):
    """Three presenter pins chosen by criteria (not by ID), first match in file order."""
    def recs(o):
        return traces[o["case_id"]].get("reconciliation", [])

    def clean_close(o, codes):
        r = recs(o)
        return o["reason_code"] in codes and r and all(x["cleared"] and x["unexplained_gbp"] == 0 and
                                                      x["explained_gbp"] > 0 for x in r) and \
            len(set(d for x in r for d in x["explained_by"])) == 1

    def esc_trap(o, need_contra):
        t = traces[o["case_id"]]
        return o["reason_code"] == "ESC_LISTED_PARTY" and (not need_contra or any(
            e["rel"] == "contradicts" for e in t["edges"]))

    def rfi_partial(o):
        r = recs(o)
        return o["verdict"] == "RFI" and r and any(x["unexplained_gbp"] > 0 for x in r) and \
            any(x["explained_gbp"] + x.get("profile_gbp", 0) > 0 for x in r)

    tiers = {
        "close": [lambda o: clean_close(o, {"INVOICE_MATCHES"}), lambda o: clean_close(o, {
            "DOCUMENTED_EVENT", "THIRD_PARTY_DOCUMENTED", "REFUND_OF_EARLIER_PAYMENT", "OWN_ACCOUNT"}),
                  lambda o: o["verdict"] == "CLOSE"],
        "esc": [lambda o: esc_trap(o, True), lambda o: esc_trap(o, False), lambda o: o["verdict"] == "ESCALATE"],
        "rfi": [rfi_partial, lambda o: o["verdict"] == "RFI"],
    }
    demo = {}
    for k, fs in tiers.items():
        for f in fs:
            hit = next((o["case_id"] for o in outs if f(o)), None)
            if hit:
                demo[k] = hit
                break
    return demo


def recon_segments(o, t, tx, cust_name):
    recs = t.get("reconciliation", [])
    explains = defaultdict(list)
    for e in t["edges"]:
        if e["rel"] == "explains":
            explains[e["to"]].append(e["from"])
    alerted = []
    for r in recs:
        pass
    seen, segs = set(), OrderedDict()
    onward_docs = sorted(set(d for tid, ds in explains.items() for d in ds))
    cleared_alert_txn, unexpl = set(), set()
    alert_txns = OrderedDict()
    for n in t["nodes"]:
        pass
    for e in t["edges"]:
        if e["rel"] == "fired_on" and e["from"] in o["alert_ids"] and e["to"] in tx:
            alert_txns.setdefault(e["to"], set()).add(e["from"])
    rec_by_alert = {r["alert_id"]: r for r in recs}
    for r in recs:
        for x in r.get("unexplained_txns", []):
            if not r["cleared"]:
                unexpl.add(x)
    profile_note = {}
    for tid in alert_txns:
        x = tx[tid]
        amt = x["amount_gbp"]
        al_cleared = all(rec_by_alert.get(a, {}).get("cleared") for a in alert_txns[tid])
        if explains.get(tid):
            key = ("doc", sorted(explains[tid])[0])
        elif tid in unexpl:
            key = ("unexplained", None)
        else:
            key = ("profile", None)
        s = segs.setdefault(key, {"kind": key[0], "doc": key[1], "amount": 0.0, "txns": []})
        s["amount"] = round(s["amount"] + amt, 2)
        s["txns"].append(tid)
    order = sorted(segs.values(), key=lambda s: ({"doc": 0, "profile": 1, "unexplained": 2}[s["kind"]], s["doc"] or ""))
    total = round(sum(s["amount"] for s in order), 2)
    unex = round(sum(s["amount"] for s in order if s["kind"] == "unexplained"), 2)
    return {"total": total, "unexplained": unex, "segments": order,
            "rule_view": [{"alert": r["alert_id"], "rule": r["rule"], "alerted": r["alerted_gbp"],
                           "explained": r["explained_gbp"], "unexplained": r["unexplained_gbp"],
                           "cleared": r["cleared"], "limit": r.get("limit_gbp"),
                           "residual": r.get("residual_activity_gbp")} for r in recs]}


def highlights(doc_id, o, t, tx, cname):
    sup, con = set(), set()
    linked = set()
    for e in t["edges"]:
        if e["from"] == doc_id and e["to"] in tx:
            linked.add(e["to"])
    for tid in linked:
        x = tx[tid]
        sup.add(fmt(x["amount_gbp"]))
        if x.get("counterparty_name"):
            sup.add(x["counterparty_name"])
        d = dtxt(x["booked_at"])
        if d:
            sup.add(d)
        if x.get("reference") and len(x["reference"]) > 5:
            sup.add(x["reference"])
    if cname:
        sup.add(cname)
    contra_doc = any(e["rel"] == "contradicts" and doc_id in (e["from"], e["to"]) for e in t["edges"])
    for f in t.get("facts", []):
        if doc_id not in f.get("sources", []):
            continue
        vals = []
        for k, v in f.items():
            if k in ("id", "kind", "sources", "rule", "code") or v is None or isinstance(v, (dict, list)):
                continue
            v = str(v)
            vals.append(dtxt(v) or v)
            m = re.match(r"(\d{4})-(\d{2})", v)
            if m and re.search(r"dob|born|birth", k):
                vals.append("%s %s" % (MONTHS[int(m.group(2)) - 1], m.group(1)))
        rose = contra_doc or "differs" in f["kind"] or (o["verdict"] == "ESCALATE" and "explains" != f["kind"])
        (con if rose else sup).update(x for x in vals if x and len(x) >= 3)
    for e in o["evidence"]:
        sup.add(e)
    for n in t["nodes"]:
        if n["type"] == "list_entry" and contra_doc or (n["type"] == "list_entry" and o["verdict"] == "ESCALATE"):
            con.add(n.get("label") or "")
    for x in t.get("list_resolution", []):
        if x.get("lname") and doc_id in (x.get("docs") or []):
            (con if x.get("status") == "confirmed" else sup).add(x["lname"])
    sup -= con
    return {"sup": sorted(sup, key=lambda s: -len(s)), "con": sorted(con, key=lambda s: -len(s))}


RULE_WORDS = {"TM01": "Activity above declared profile", "TM02": "Money in and straight out", "TM03": "Payments just under a threshold",
              "TM04": "Many counterparties", "TM05": "Large cash", "TM06": "Higher-risk country", "TM07": "Dormant account reactivated",
              "TM08": "Third-party money", "TM10": "Early fund redemption", "TM22": "Internal watch-list match"}


def _d(iso):
    return dtxt(iso) or str(iso or "")


def _short(iso):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(iso or ""))
    return "%d %s" % (int(m.group(3)), MONTHS[int(m.group(2)) - 1][:3]) if m else str(iso or "")


def build_story(o, t, tx, alerts, cust, docs_by_id):
    """Plain-English check cards, generated deterministically from the trace (no LLM)."""
    facts = {f["id"]: f for f in t.get("facts", [])}
    fl = t.get("facts", [])
    cards = []
    def card(status, title, detail, docs, weight=0):
        cards.append({"status": status, "title": title, "detail": detail, "docs": [x for x in docs if x], "w": weight})
    kinds = defaultdict(list)
    for f in fl:
        kinds[f["kind"]].append(f)
    lr = {x.get("entry"): x for x in t.get("list_resolution", [])}
    lname = next((x.get("lname") for x in t.get("list_resolution", []) if x.get("lname")), "the listed person")
    docsrc = lambda f: [x for x in f["sources"] if x in docs_by_id]
    # suspicion and list facts
    for f in kinds["listed_person_controlled_counterparty_at_payment"]:
        pct = re.search(r"\((\d+%)\)", f.get("control") or "")
        res = kinds["officer_resigned_before_payment"]
        lead = ("Resigned as director %s, but " % _short(res[0]["resigned"])) if res else ""
        card("fail", "%s still controlled the payee when it was paid" % lname,
             "%sheld %s until %s; the payment was on %s." % (lead, pct.group(1) if pct else "control",
                                                            _short(f.get("ceased")) if f.get("ceased") else "now",
                                                            _short(f.get("payment"))),
             docsrc(f) + [x for r in res for x in r["sources"]], 10)
    for f in kinds["counterparty_dob_equals_list_dob"]:
        card("fail", "Donor's date of birth matches the list entry", "Born %s, the same as %s on the internal list." % (
            _d(f["dob"]), lname), docsrc(f), 10)
    for f in kinds["counterparty_dob_differs_from_list"]:
        card("pass", "Different person from the list entry", "Donor born %s; %s was born %s." % (
            _d(f["dob"]), lname, _d(f.get("list_dob"))), docsrc(f), 6)
    for f in kinds["counterparty_address_differs_from_list"]:
        card("pass", "Different party from the list entry", "Payee is at %s; %s is linked to %s." % (
            f.get("counterparty_unit"), lname, f.get("list_unit")), docsrc(f), 6)
    for f in kinds.get("officer_birth_differs_from_list", []):
        card("pass", "Different person from the list entry", "Register birth date differs from %s's." % lname, docsrc(f), 6)
    sc = kinds["scam_report_sender_paid_customer"]
    if sc:
        senders = sorted(set(f.get("sender") for f in sc if f.get("sender")))
        card("fail", "%d scam report%s name people who paid this account" % (len(sc), "" if len(sc) == 1 else "s"),
             "Senders %s, %s in total." % (", ".join(senders[:3]), fmt(sum(f.get("amount") or 0 for f in sc))),
             sorted(set(x for f in sc for x in docsrc(f))), 10)
    TPL = {
        "customer_invests_for_third_parties": ("Customer says they handle other people's money", lambda f: "\u201c%s\u201d" % f.get("quote", "")),
        "payer_company_dissolved_before_payment": ("Payer company no longer existed", lambda f: "%s was dissolved on %s, before it paid." % (f.get("company"), _d(f.get("dissolved_on")))),
        "customer_asked_how_to_avoid_threshold": ("Customer asked how to stay under a threshold", lambda f: "Recorded in a staff note."),
        "split_payments_to_unrelated_people_in_high_risk_country": ("Money split between unrelated people in %s", lambda f: "No document shows who they are."),
        "funds_routed_to_new_companies_of_same_director": ("Money passed on to the director's new companies", lambda f: "Companies set up recently by %s." % (f.get("director") or "").title()),
        "device_shared_with_other_customers": ("Device shared with other customers", lambda f: "%d customer IDs use it; logins from %s." % (len(f.get("customers") or []), f.get("countries"))),
        "client_cannot_explain_corridor": ("Client can't explain the routing to %s", lambda f: "Recorded in a staff note."),
        "invoice_goods_inconsistent_with_business": ("Invoices don't fit the business", lambda f: "%s, for a business that %s." % (f.get("goods"), (f.get("business_activity") or "").lower())),
        "payees_share_addresses_inconsistent_with_country": ("Payees abroad share UK addresses", lambda f: "%s payees listed abroad have UK addresses." % f.get("uk_address_abroad")),
        "customer_gives_conflicting_explanations": ("Customer gave conflicting stories", lambda f: "%s, then %s." % (" / ".join(f.get("first") or []), " / ".join(f.get("second") or []))),
        "suspicion_keyword": ("Documents mention %s", lambda f: "Unexplained activity plus a fraud indicator."),
    }
    for k, (title, det) in TPL.items():
        for f in kinds.get(k, [])[:1]:
            tt = title % (f.get("country") or f.get("word") or "") if "%s" in title else title
            card("fail", tt, det(f), docsrc(f) or f["sources"][:2], 9)
    # explanations (decisive and advisory)
    seen_docs = set()
    for fr in t.get("firings", []):
        if not re.match(r"X\d+_", fr["rule"]):
            continue
        ds = [d for d in fr.get("docs", []) if d in docs_by_id]
        if not ds or ds[0] in seen_docs:
            continue
        seen_docs.add(ds[0])
        txs = sorted([tx[x] for x in fr.get("txns", []) if x in tx], key=lambda x: -x["amount_gbp"])
        d0 = docs_by_id[ds[0]]
        what = d0.get("type", "").replace("_", " ")
        if fr["rule"] == "X2_own_account_statement":
            title = "Statement %s proves it's the customer's own account" % ds[0]
        else:
            title = "%s %s matches %s" % (what[:1].upper() + what[1:], ds[0], fmt(txs[0]["amount_gbp"]) if txs else "the amounts")
        det = ("%s %s %s on %s" % (fmt(txs[0]["amount_gbp"]), "from" if txs[0]["direction"] == "in" else "to",
                                   txs[0].get("counterparty_name") or "cash", _short(txs[0]["booked_at"]))) if txs else ""
        if len(txs) > 1:
            det += " and %d more" % (len(txs) - 1)
        card("pass", title, det + ".", ds, 5)
    # reconciliation per alert
    for r in t.get("reconciliation", []):
        words = RULE_WORDS.get(r["rule"], r["rule"])
        if not r["cleared"] and r["rule"] != "TM22":
            card("info", "%s of %s has no supporting document" % (fmt(r["unexplained_gbp"]), fmt(r["alerted_gbp"])),
                 "%s alert %s is still open." % (words, r["alert_id"]), r.get("explained_by", []), 8)
        if r.get("profile_gbp", 0) > 0 and not any(c["title"].startswith("Regular activity") for c in cards):
            card("pass", "Regular activity: %s" % fmt(r["profile_gbp"]), "Within the declared profile (e.g. salary, card takings).", [], 2)
    for x in t.get("list_resolution", []):
        if x.get("status") == "unsettled":
            card("info", "Name-only match with %s" % x.get("lname"), "Nothing on file settles whether it is the same person.",
                 [x.get("entry")], 9)
    if o["reason_code"] == "RFI_UPDATED_PROFILE":
        card("info", "Own money, but far above the declared profile", "Activity is 5x or more of what the customer declared.", [], 9)
    order = {"fail": 0, "info": 1, "pass": 2}
    cards.sort(key=lambda c: (order[c["status"]], -c["w"]))
    if o["verdict"] == "CLOSE":
        card("pass", "Nothing left unexplained", "Every alerted pound is booked against evidence: %s unexplained." % fmt(0), [], 1)
        card("pass", "No red flags", "None of the suspicion rules fired on this customer's documents.", [], 0)
        cards.sort(key=lambda c: (order[c["status"]], -c["w"]))
    for c in cards:
        c.pop("w", None)
    money = []
    for a in alerts:
        amt = sum(tx[x]["amount_gbp"] for x in set(a["transaction_ids"]) if x in tx)
        money.append({"alert": a["alert_id"], "rule": a["rule_id"], "words": RULE_WORDS.get(a["rule_id"], a["rule_id"]),
                      "amount": round(amt, 2)})
    return {"money": money, "checks": cards[:5], "more": max(0, len(cards) - 5)}


def build(inst, detail_n, runs, base=None, out=None, extra=()):
    """Bundle for one institution. base/out default to the repo; the in-browser Import page passes its own."""
    base = base or os.path.join(ROOT, "institutions", inst)
    out = out or os.path.join(ROOT, "output", inst + ".jsonl")
    outs = jl(out)
    traces = {t["case_id"]: t for t in jl(out + ".trace.jsonl")}
    cases = {c["case_id"]: c for c in jl(os.path.join(base, "cases.jsonl"))}
    alerts = {a["alert_id"]: a for a in jl(os.path.join(base, "alerts.jsonl"))}
    custs = {c["customer_id"]: c for c in jl(os.path.join(base, "customers.jsonl"))}
    txs_by = defaultdict(list)
    for x in jl(os.path.join(base, "transactions.jsonl")):
        txs_by[x["customer_id"]].append(x)
    docs_by = defaultdict(list)
    for d in jl(os.path.join(base, "evidence.jsonl")):
        docs_by[d["customer_id"]].append(d)
    reviews_by = defaultdict(list)
    for r in jl(os.path.join(base, "previous_reviews.jsonl")):
        reviews_by[r["customer_id"]].append(r)
    listed = {r["entry_id"]: r for r in jl(os.path.join(base, "internal_list.jsonl"))}

    demos = pick_demos(outs, traces)
    # stratified detail subset: round-robin over reason codes in file order
    by_code = defaultdict(list)
    for o in outs:
        by_code[o["reason_code"]].append(o["case_id"])
    chosen = [c for c in demos.values() if c]
    chosen += [c for c in extra if c not in chosen]
    detail_n += len(chosen) - len([c for c in demos.values() if c])
    i = 0
    while len(chosen) < min(detail_n, len(outs)):
        added = False
        for code in sorted(by_code):
            if i < len(by_code[code]) and len(chosen) < detail_n:
                if by_code[code][i] not in chosen:
                    chosen.append(by_code[code][i])
                added = True
        if not added:
            break
        i += 1
    chosen = set(chosen)

    rows, detail = [], {}
    for o in outs:
        c = cases[o["case_id"]]
        cust = custs.get(c["customer_id"], {})
        als = [alerts[a] for a in o["alert_ids"] if a in alerts]
        tx = {x["transaction_id"]: x for x in txs_by[c["customer_id"]]}
        amt = round(sum(tx[t]["amount_gbp"] for t in set(x for a in als for x in a["transaction_ids"]) if t in tx), 2)
        rows.append({"id": o["case_id"], "name": cust.get("name", ""), "rules": [a["rule_id"] for a in als],
                     "amount": amt, "verdict": o["verdict"], "code": o["reason_code"],
                     "alerts": len(o["alert_ids"]), "detail": o["case_id"] in chosen,
                     "reason": o["reason"], "evidence": o["evidence"], "alert_ids": o["alert_ids"],
                     "fired": sorted(set(re.sub(r"^R_TM22_.*", "R_TM22", f["rule"]) for f in traces[o["case_id"]]["firings"]
                                         if not f.get("advisory")))})
        if o["case_id"] not in chosen:
            continue
        t = traces[o["case_id"]]
        rw = c.get("review_window") or {}
        lo, hi = rw.get("from", ""), rw.get("to", "9999")
        alerted = set(x for a in als for x in a["transaction_ids"])
        graph_tx = set(n["id"] for n in t["nodes"] if n["type"] == "transaction")
        lo_pad = "%s" % (date.fromisoformat(lo).replace(day=1).isoformat() if lo else "")
        timeline = [x for x in sorted(tx.values(), key=lambda x: (x["booked_at"], x["transaction_id"]))
                    if (lo_pad <= x["booked_at"][:10] <= hi) or x["transaction_id"] in alerted or
                    x["transaction_id"] in graph_tx]
        if len(timeline) > 160:
            timeline = [x for x in timeline if x["transaction_id"] in alerted or x["transaction_id"] in graph_tx] + \
                       [x for x in timeline if x["transaction_id"] not in alerted and
                        x["transaction_id"] not in graph_tx][-60:]
            timeline.sort(key=lambda x: (x["booked_at"], x["transaction_id"]))
        tl = [{"id": x["transaction_id"], "at": x["booked_at"], "dir": x["direction"], "amt": x["amount_gbp"],
               "cp": x.get("counterparty_name") or ("cash · " + (x.get("location") or "")), "ref": x.get("reference"),
               "ch": x.get("channel"), "cc": x.get("counterparty_country"), "ccy": x.get("currency"),
               "alerted": x["transaction_id"] in alerted} for x in timeline]
        docs = []
        for d in sorted(docs_by[c["customer_id"]], key=lambda d: d["doc_id"]):
            try:
                md = open(os.path.join(base, d.get("file") or "evidence/%s.md" % d["doc_id"]), encoding="utf-8").read()
            except OSError:
                md = ""
            docs.append({"id": d["doc_id"], "type": d.get("type"), "title": d.get("title"), "dated": d.get("dated"),
                         "boiler": d.get("type") in BOILER, "md": md,
                         "hl": highlights(d["doc_id"], o, t, tx, cust.get("name"))})
        detail[o["case_id"]] = {
            "out": o, "case": {"opened_at": c.get("opened_at"), "window": rw, "held": c.get("held_payment_id"),
                               "customer_id": c["customer_id"]},
            "customer": {k: cust.get(k) for k in ("customer_id", "name", "kind", "employer", "business_activity",
                                                  "declared", "date_of_birth", "opened_at") if k in cust},
            "alerts": [{"id": a["alert_id"], "rule": a["rule_id"], "measured": a.get("measured"),
                        "txns": a["transaction_ids"], "message": a.get("message") or a.get("description")}
                       for a in als],
            "trace": {k: t.get(k) for k in ("nodes", "edges", "facts", "firings", "reconciliation", "list_resolution")},
            "recon": recon_segments(o, t, tx, cust.get("name")),
            "timeline": tl, "docs": docs,
            "reviews": reviews_by.get(c["customer_id"], []),
            "story": build_story(o, t, tx, als, cust, {d["doc_id"]: d for d in docs_by[c["customer_id"]]}),
            "list": [listed[e] for e in sorted(set(n["id"] for n in t["nodes"] if n["type"] == "list_entry"))
                     if e in listed],
        }
    fp = fingerprint(inst, runs) if runs else []
    return {"inst": inst, "rows": rows, "detail": detail, "demos": demos, "runs": fp}


def ontology_js():
    """Class hierarchy from system/ontology/proof.owl + the engine's type->class maps, for the viewer."""
    import importlib.machinery, importlib.util
    ld = importlib.machinery.SourceFileLoader("proof_run", os.path.join(ROOT, "system", "run"))
    spec = importlib.util.spec_from_loader("proof_run", ld)
    eng = importlib.util.module_from_spec(spec)
    ld.exec_module(eng)
    owl = open(os.path.join(ROOT, "system", "ontology", "proof.owl"), encoding="utf-8").read()
    parent, classes, props = {}, [], []
    for m in re.finditer(r"^proof:(\w+)\s+a owl:Class\b([^\n]*)", owl, re.M):
        classes.append(m.group(1))
        sc = re.search(r"rdfs:subClassOf proof:(\w+)", m.group(2))
        if sc:
            parent[m.group(1)] = sc.group(1)
    for m in re.finditer(r"^proof:(\w+)\s+a owl:(Object|Datatype)Property", owl, re.M):
        props.append((m.group(1), m.group(2)))
    kids = defaultdict(list)
    for c in classes:
        kids[parent.get(c)].append(c)
    lines = []
    def walk(c, depth):
        lines.append("  " * depth + ("└ " if depth else "") + c)
        for k in kids.get(c, []):
            walk(k, depth + 1)
    for c in kids[None]:
        walk(c, 0)
    lines.append("")
    lines.append("object properties:")
    lines += ["  " + p for p, k in props if k == "Object"]
    data = {"tree": "\n".join(lines), "nodeClass": eng.NODE_CLASS, "docClass": eng.DOC_CLASS, "edgeProp": eng.EDGE_PROP}
    with open(os.path.join(ROOT, "viewer", "data", "ontology.js"), "w", encoding="utf-8") as fh:
        fh.write("window.PROOF_ONTOLOGY = %s;\n" % json.dumps(data, ensure_ascii=False, sort_keys=True))


def engine_js():
    """Engine + bundle builder sources and policy defaults, for the in-browser (Pyodide) Import page."""
    import importlib.machinery, importlib.util
    ld = importlib.machinery.SourceFileLoader("proof_run", os.path.join(ROOT, "system", "run"))
    spec = importlib.util.spec_from_loader("proof_run", ld)
    eng = importlib.util.module_from_spec(spec)
    ld.exec_module(eng)
    run_src = open(os.path.join(ROOT, "system", "run"), encoding="utf-8").read()
    bd_src = open(os.path.abspath(__file__), encoding="utf-8").read()
    data = {"run": run_src, "build": bd_src, "policy": eng.POLICY, "keys": eng.POLICY_KEYS,
            "run_sha256": hashlib.sha256(run_src.encode("utf-8")).hexdigest()}
    with open(os.path.join(ROOT, "viewer", "data", "engine.js"), "w", encoding="utf-8") as fh:
        fh.write("window.PG_ENGINE = %s;\n" % json.dumps(data, ensure_ascii=False, sort_keys=True))


def main():
    detail_n, runs = arg("--detail", 200), arg("--runs", 5)
    ontology_js()
    engine_js()
    bp = os.path.join(ROOT, "viewer", "data", "briefs.json")
    briefs = json.load(open(bp, encoding="utf-8")) if os.path.exists(bp) else {}
    os.makedirs(os.path.join(ROOT, "viewer", "data"), exist_ok=True)
    index = []
    for inst in INSTS:
        if not os.path.exists(os.path.join(ROOT, "output", inst + ".jsonl.trace.jsonl")):
            continue
        data = build(inst, detail_n, runs)
        for cid, d in data["detail"].items():
            if cid in briefs:
                d["brief"] = briefs[cid]
        p = os.path.join(ROOT, "viewer", "data", inst + ".js")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write("window.PROOF_DATA = window.PROOF_DATA || {};\nwindow.PROOF_DATA[%s] = " % json.dumps(inst))
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
            fh.write(";\n")
        index.append(inst)
        print(inst, "rows", len(data["rows"]), "detail", len(data["detail"]), "demos", data["demos"],
              "runs", [r["verdict_code_hash"] for r in data["runs"]], "%.1f MB" % (os.path.getsize(p) / 1e6))
    with open(os.path.join(ROOT, "viewer", "data", "index.js"), "w") as fh:
        fh.write("window.PROOF_INSTS = %s;\n" % json.dumps(index))


if __name__ == "__main__":
    main()
