#!/usr/bin/env python3
"""Consistency check: every node class, edge property and RDF term the engine emits must be defined in
system/ontology/proof.owl. Not part of system/run's scored path. Exits 1 (loudly) on any undefined term.

usage: python3 system/tests/check_ontology.py [output_dir]
"""
import glob, importlib.machinery, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SYSTEM = os.path.dirname(HERE)
ROOT = os.path.dirname(SYSTEM)
OWL = os.path.join(SYSTEM, "ontology", "proof.owl")


def declared():
    txt = open(OWL, encoding="utf-8").read()
    kinds = {"owl:Class": set(), "owl:ObjectProperty": set(), "owl:DatatypeProperty": set(), "owl:NamedIndividual": set()}
    for m in re.finditer(r"^proof:(\w+)\s+a\s+([^;.]+)", txt, re.M):
        for k in kinds:
            if k in m.group(2):
                kinds[k].add(m.group(1))
    return kinds


def load_engine():
    ld = importlib.machinery.SourceFileLoader("proof_run", os.path.join(SYSTEM, "run"))
    spec = importlib.util.spec_from_loader("proof_run", ld)
    mod = importlib.util.module_from_spec(spec)
    ld.exec_module(mod)
    return mod


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "output")
    D = declared()
    classes, objp, datap, indiv = D["owl:Class"], D["owl:ObjectProperty"], D["owl:DatatypeProperty"], D["owl:NamedIndividual"]
    errors = []
    eng = load_engine()
    # 1. the engine's vocabulary maps
    for name, mp in (("NODE_CLASS", eng.NODE_CLASS), ("DOC_CLASS", eng.DOC_CLASS)):
        for k, v in sorted(mp.items()):
            if v not in classes:
                errors.append("%s[%s] = %s is not an owl:Class" % (name, k, v))
    for k, v in sorted(eng.EDGE_PROP.items()):
        if v not in objp:
            errors.append("EDGE_PROP[%s] = %s is not an owl:ObjectProperty" % (k, v))
    for rc in sorted(eng.VERDICT_OF):
        if rc not in indiv:
            errors.append("reason code %s is not a NamedIndividual" % rc)
    for v in sorted(set(eng.VERDICT_OF.values())):
        if v not in indiv:
            errors.append("verdict %s is not a NamedIndividual" % v)
    # 2. traces
    n_tr = 0
    for p in sorted(glob.glob(os.path.join(outdir, "*.trace.jsonl"))):
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                t = json.loads(line)
                n_tr += 1
                for n in t.get("nodes", []):
                    if n.get("type") not in eng.NODE_CLASS:
                        errors.append("%s %s: node type %r has no ontology class" % (os.path.basename(p), t["case_id"], n.get("type")))
                    if n.get("class") not in classes:
                        errors.append("%s %s: node class %r undefined" % (os.path.basename(p), t["case_id"], n.get("class")))
                for e in t.get("edges", []):
                    if e.get("rel") not in eng.EDGE_PROP or e.get("property") not in objp:
                        errors.append("%s %s: edge %r/%r undefined" % (os.path.basename(p), t["case_id"], e.get("rel"), e.get("property")))
    # 3. RDF exports
    n_kg = 0
    for p in sorted(glob.glob(os.path.join(outdir, "*.kg.ttl"))):
        with open(p, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip() or line.startswith("@prefix"):
                    continue
                n_kg += 1
                m = re.match(r"(\S+) (\S+) (.+) \.$", line.rstrip("\n"))
                if not m:
                    errors.append("%s: unparsable triple %r" % (os.path.basename(p), line[:80]))
                    continue
                s_, p_, o_ = m.groups()
                if p_ == "a":
                    if not o_.startswith("proof:") or o_[6:] not in classes:
                        errors.append("%s: rdf:type %s undefined" % (os.path.basename(p), o_))
                    continue
                pn = p_[6:]
                if not p_.startswith("proof:") or pn not in objp | datap:
                    errors.append("%s: property %s undefined" % (os.path.basename(p), p_))
                if o_.startswith("proof:") and o_[6:] not in indiv | classes:
                    errors.append("%s: individual %s undefined" % (os.path.basename(p), o_))
                if pn in datap and not (o_.startswith('"')):
                    errors.append("%s: data property %s with non-literal %s" % (os.path.basename(p), p_, o_[:40]))
                if pn in objp and o_.startswith('"'):
                    errors.append("%s: object property %s with literal" % (os.path.basename(p), p_))
    uniq = sorted(set(errors))
    if uniq:
        sys.stderr.write("ONTOLOGY CHECK FAILED: %d undefined terms\n" % len(uniq))
        for e in uniq[:60]:
            sys.stderr.write("  - " + e + "\n")
        sys.exit(1)
    print("ontology check OK: %d classes, %d object props, %d data props, %d individuals; %d traces, %d triples checked"
          % (len(classes), len(objp), len(datap), len(indiv), n_tr, n_kg))


if __name__ == "__main__":
    main()
