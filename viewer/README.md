# PROOF analyst workbench (static, offline)

Open `viewer/index.html` directly in a browser (file:// works with no server). Every library and font is vendored in `vendor/`.

## Rebuild the data bundle after a new engine run
```
system/run institutions/<inst> output/<inst>.jsonl --trace     # for each institution
python3 viewer/build_data.py              # data/<inst>.js + data/ontology.js, with a fresh 5-run determinism fingerprint
python3 viewer/make_briefs.py --limit 200 # optional plain-English briefs (Grok if XAI_API_KEY is set, else a template), fact-checked
python3 viewer/build_data.py --runs 5     # merge the briefs into the bundle
```
Options:
- `--detail N`: number of graph-ready cases per institution (default 200, including the three pinned demo cases; `--detail 1000` includes all of them, about 15 MB per institution).
- `--runs 0`: skip the five re-runs.

**Load trace…** in the header accepts a fresh `*.trace.jsonl` (plus its `*.jsonl`) without a rebuild.

## Keys
| Key | Action |
|---|---|
| `j` / `k` | queue |
| `Enter` | open |
| `f` | fit |
| `p` | presentation size |
| `Esc` | clear |
