# PoliGraph viewer (static, offline)

Multi-page app (hash routing, vanilla JS, vendored libs): Overview `#/`, Queue `#/queue`, Case `#/case/<id>/<decision|why|documents|timeline>`,
Rules `#/rules`, How it works `#/about`, Import `#/import`. Open `viewer/index.html` from file:// for everything except Import.
Overview and Queue have an institution switcher (All / Bank / E-money / Investment / Payments FX); **All** is the default and
combines the 4,000 dev cases (KPIs, verdict mix, top reasons, a per-institution table, and an Institution column in the Queue).
Every case has a full case page (Decision, Why, Documents, Timeline). Case detail is lazy-loaded: `data/<inst>.js` holds only
the summary rows (~0.7 MB each); the proof for each case lives in `data/detail/<inst>-<k>.js` shards of 100 cases, fetched
when a case is opened.
The previous single-screen workbench is kept in `viewer/legacy/`.

## Import + policy what-if (needs http, because WebAssembly can't load from file://)
```
python3 -m http.server -d viewer 8000   # then http://localhost:8000/#/import
```
Drop an institution folder or .zip (or pick a sample from `data/inst/*.zip`): the exact `system/run` runs in the browser via
Pyodide (`vendor/pyodide`), the result is checked byte for byte against the bundled official output hash, and opens in the
same queue/case UI (session only). Engine output (.jsonl/.trace.jsonl/.csv) can also be loaded view-only.
Policy what-if re-runs every case with edited thresholds, shows the verdict diff, and an Approve step records a versioned
change (old/new, approver, reason, time, impact) in localStorage with Pending/Approved/Reverted status and a download of
`policy-overrides.json` for `system/run --policy=policy-overrides.json`.

## Rebuild the data bundle after a new engine run
```
system/run institutions/<inst> output/<inst>.jsonl --trace     # for each institution
python3 viewer/build_data.py --runs 5   # data/<inst>.js rows, data/detail/* shards, ontology.js, engine.js (engine source for Import), 5-run fingerprint
python3 viewer/make_briefs.py --limit 200   # optional briefs, then build_data.py again
```
