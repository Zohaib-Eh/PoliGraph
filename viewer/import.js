/* PoliGraph Import + policy what-if: runs system/run in the browser with Pyodide (vendored in vendor/pyodide).
   Session-only results; approved policy changes are logged in localStorage and exported as policy-overrides.json. */
(function () {
  "use strict";
  const LOG_KEY = "poligraph.policyLog.v1";
  const PY_HELPERS = `
import sys, os, io, json, hashlib, zipfile, shutil, contextlib, importlib.util
def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
def pg_unzip(path, dest):
    zipfile.ZipFile(path).extractall(dest)
def pg_find_root(base):
    for r, ds, fs in sorted(os.walk(base)):
        ds.sort()
        if "cases.jsonl" in fs and "__MACOSX" not in r:
            return r
    return ""
def pg_inst(folder):
    with open(os.path.join(folder, "cases.jsonl"), encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                return json.loads(line).get("institution") or os.path.basename(folder)
    return os.path.basename(folder)
def pg_run(folder, out, policy_json):
    eng = _load("pg_run", "/pg/run.py")   # fresh module = fresh POLICY defaults on every run
    argv = ["run", folder, out, "--trace"]
    if policy_json:
        with open("/pg/policy-overrides.json", "w", encoding="utf-8") as fh:
            fh.write(policy_json)
        argv.append("--policy=/pg/policy-overrides.json")
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        rc = eng.main(argv)
    data = open(out, "rb").read()
    rows = [json.loads(l) for l in data.decode("utf-8").splitlines() if l.strip()]
    vc = hashlib.sha256("\\n".join("%s|%s|%s" % (r["case_id"], r["verdict"], r["reason_code"]) for r in rows).encode()).hexdigest()
    return json.dumps({"rc": rc, "stderr": err.getvalue(), "file_hash": hashlib.sha256(data).hexdigest()[:12],
                       "verdict_code_hash": vc[:12], "n": len(rows),
                       "rows": [[r["case_id"], r["verdict"], r["reason_code"]] for r in rows]})
def pg_bundle(inst, folder, out, detail, extra):
    bd = _load("pg_build", "/pg/build_data.py")
    return json.dumps(bd.build(inst, detail, 0, base=folder, out=out, extra=json.loads(extra)), ensure_ascii=False)
`;
  let PY = null;          // Promise<pyodide>
  const ST = { session: null, whatif: null, steps: [], busy: false, view: null };
  const tick = () => new Promise((r) => setTimeout(r, 30));
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.body.appendChild(s); });
  }
  async function py() {
    if (PY) return PY;
    PY = (async () => {
      if (location.protocol === "file:") throw new Error("The in-browser engine needs the viewer served over http (WebAssembly cannot load from file://). Run: python3 -m http.server -d viewer 8000, then open http://localhost:8000/#/import");
      if (!window.PG_ENGINE) await loadScript("data/engine.js");
      if (!window.loadPyodide) await loadScript("vendor/pyodide/pyodide.js");
      const p = await loadPyodide({ indexURL: new URL("vendor/pyodide/", location.href).href });
      p.FS.mkdirTree("/pg");
      p.FS.writeFile("/pg/run.py", window.PG_ENGINE.run);
      p.FS.writeFile("/pg/build_data.py", window.PG_ENGINE.build);
      p.runPython(PY_HELPERS);
      return p;
    })();
    PY.catch(() => (PY = null));
    return PY;
  }
  const pyCall = (p, fn, ...args) => p.globals.get(fn)(...args);

  /* ---------- change log (localStorage) ---------- */
  const readLog = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch (_) { return []; } };
  const writeLog = (l) => localStorage.setItem(LOG_KEY, JSON.stringify(l));
  function activeFor(inst) {
    const l = readLog().filter((e) => e.inst === inst && e.status === "approved");
    return l.length ? l[l.length - 1] : null;
  }
  function overrideDoc(e) {
    return { schema: "poligraph.policy-overrides/1", institution: e.inst, version: e.version, approved_by: e.approver,
      approved_at: e.ts, reason: e.reason, overrides: e.overrides };
  }
  function download(name, obj) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.PG_IMPORT = function (main, A) {
    const { esc, gbp0, n0, page, ph, pill, words, counts, mixBar } = A;
    const keys = () => (window.PG_ENGINE && window.PG_ENGINE.keys) || {};
    const defaults = (inst) => ((window.PG_ENGINE && window.PG_ENGINE.policy) || {})[inst] || {};
    const fmtVal = (k, v) => v == null ? "per alert" : /gbp|min/.test(k) ? gbp0(v) : v + "×";
    const sess = ST.session;
    const steps = ST.steps.map((s) => `<div class="li"><div><div class="t">${s.state === "done" ? '<span style="color:var(--close)">✓</span>' : s.state === "err" ? '<span style="color:var(--esc)">✕</span>' : '<span class="pill pending" style="padding:0 6px"></span>'} ${esc(s.label)}</div>${s.note ? `<div class="d">${esc(s.note)}</div>` : ""}</div><div class="num note">${s.ms != null ? (s.ms / 1000).toFixed(1) + " s" : ""}</div></div>`).join("");
    const insts = window.PROOF_INSTS || [];
    let res = "";
    if (sess) {
      const c = counts(sess.rows);
      const official = window.PROOF_DATA[sess.inst];
      const ofRuns = official && official.runs && official.runs[0];
      const match = ofRuns ? (ofRuns.file_hash === sess.file_hash ? `<span style="color:var(--close)">✓ Byte-identical to output/${esc(sess.inst)}.jsonl</span> · sha256 ${sess.file_hash}` : `<span style="color:var(--rfi)">Differs from the bundled official output</span> (sha256 ${sess.file_hash} vs ${ofRuns.file_hash})`) : `sha256 ${sess.file_hash}`;
      res = `<div class="card"><h2>Result · ${esc(sess.label)}</h2><p class="hint">${n0(c.n)} cases decided in your browser in ${(sess.ms / 1000).toFixed(1)} s. ${match}</p>${mixBar(c)}
        <div style="display:flex;gap:10px;margin-top:16px"><button class="btn primary" id="openQ">Open in queue</button><button class="btn" id="openO">Overview</button></div></div>`;
    }
    // what-if form
    let wf = "";
    if (sess && sess.folder) {
      const act = activeFor(sess.inst), d = defaults(sess.inst);
      const cur = Object.assign({}, d, act ? act.overrides : {});
      const draft = (ST.whatif && ST.whatif.draft) || cur;
      wf = `<div class="card"><h2>Policy what-if</h2><p class="hint">Change a threshold and re-run every case. Defaults come from POLICY.md${act ? `; the active approved policy is <b>v${act.version}</b>` : ""}. Nothing changes for real until it is approved below.</p>
        <table class="tbl"><thead><tr><th>Setting</th><th>Default</th><th>Current</th><th>Try</th></tr></thead><tbody>${Object.entries(keys()).filter(([k]) => k !== "invoice_required_gbp" || d[k] != null).map(([k, label]) => `<tr><td><div>${esc(label)}</div><div class="muted mono">${k}</div></td><td class="num">${esc(fmtVal(k, d[k]))}</td><td class="num">${esc(fmtVal(k, cur[k]))}</td><td><input type="number" step="any" min="0" data-k="${k}" value="${draft[k] == null ? "" : draft[k]}" placeholder="${d[k] == null ? "per alert" : d[k]}" style="width:130px"></td></tr>`).join("")}</tbody></table>
        <div style="display:flex;gap:10px;margin-top:16px;align-items:center"><button class="btn primary" id="runWI" ${ST.busy ? "disabled" : ""}>Run what-if</button><button class="btn" id="resetWI">Reset to current</button><span class="note" id="wiNote"></span></div></div>`;
    }
    // diff + approve
    let diff = "", appr = "";
    const W = ST.whatif;
    if (W && W.result) {
      const b = counts(W.base.map((r) => ({ verdict: r[1] }))), a = counts(W.result.map((r) => ({ verdict: r[1] })));
      const delta = (v) => { const x = a[v] - b[v]; return `<span style="color:${x ? (x > 0 ? "var(--text)" : "var(--sub)") : "var(--faint)"}">${x > 0 ? "+" : ""}${x}</span>`; };
      const nameOf = Object.fromEntries((sess.data.rows || []).map((r) => [r.id, r]));
      diff = `<div class="card"><h2>What changes</h2><p class="hint">${n0(W.changed.length)} of ${n0(b.n)} cases change verdict${W.changedCode ? `, ${n0(W.changedCode)} more change reason only` : ""}.</p>
        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${["CLOSE", "RFI", "ESCALATE"].map((v) => `<div class="kpi"><div class="k">${pill(v)}</div><div class="v">${n0(a[v])} <span class="u">${delta(v)}</span></div><div class="s">was ${n0(b[v])}</div></div>`).join("")}</div>
        <div class="legend-row" style="margin-bottom:14px">${Object.entries(W.transitions).map(([k, n]) => `<span>${esc(k)} <b>${n0(n)}</b></span>`).join("") || "No verdict changes."}</div>
        ${W.changed.length ? `<table class="tbl"><thead><tr><th>Case</th><th>Customer</th><th>Before</th><th>After</th><th>New reason</th></tr></thead><tbody>${W.changed.slice(0, 60).map(([id, v0, v1, c1]) => `<tr class="row" data-id="${id}"><td class="cid">${id}</td><td>${esc((nameOf[id] || {}).name || "")}</td><td>${pill(v0)}</td><td>${pill(v1)}</td><td class="sub2">${esc(words(c1))}</td></tr>`).join("")}</tbody></table>${W.changed.length > 60 ? `<p class="note">+${W.changed.length - 60} more in the what-if queue.</p>` : ""}` : ""}
        <p class="note" id="wiBuild">${W.data ? "Click a case to open its proof under the new policy." : "Building case pages for the changed cases…"}</p></div>`;
      const st = W.approved ? "Approved" : "Pending";
      appr = `<div class="card"><h2>Approve change <span class="pill ${W.approved ? "CLOSE" : "pending"}" style="margin-left:8px">${st}</span></h2>
        <p class="hint">${W.changes.length ? W.changes.map((c) => `<span class="mono">${esc(c.key)}</span> ${esc(fmtVal(c.key, c.old))} → <b>${esc(fmtVal(c.key, c.new))}</b>`).join(" · ") : "No setting differs from the current policy."}</p>
        ${W.approved ? `<p>Recorded as <b>v${W.approved.version}</b> by ${esc(W.approved.approver)} · ${esc(A.londonTime(W.approved.ts))}. Pass the file to the next run: <span class="mono">system/run institutions/${esc(sess.inst)} output/${esc(sess.inst)}.jsonl --policy=policy-overrides.json</span></p><button class="btn primary" id="dlNow">Download policy-overrides.json</button>` :
        `<div style="display:grid;grid-template-columns:240px 1fr auto;gap:10px;align-items:start"><input type="text" id="apName" placeholder="Approver name"><input type="text" id="apReason" placeholder="Reason for the change"><button class="btn primary" id="apBtn" disabled>Approve</button></div><p class="note" style="margin-top:8px">Defaults stay untouched: official outputs are only ever produced without an override file.</p>`}</div>`;
    }
    // log
    const log = readLog();
    const pend = W && W.result && !W.approved && W.changes.length ? `<tr><td class="num">—</td><td>${esc(sess.inst)}</td><td>${W.changes.map((c) => `<span class="mono">${esc(c.key)}</span> ${esc(fmtVal(c.key, c.old))} → ${esc(fmtVal(c.key, c.new))}`).join("<br>")}</td><td class="sub2">${impactTxt(W.impact)}</td><td class="muted">awaiting approval</td><td><span class="pill pending">Pending</span></td><td></td></tr>` : "";
    const logHtml = `<div class="card tblwrap"><h2 style="padding:14px 4px 0">Policy change log</h2><p class="hint" style="padding:0 4px">Versioned, stored in this browser. The latest approved version per institution is the active policy.</p>
      <table class="tbl"><thead><tr><th>Version</th><th>Institution</th><th>Change</th><th>Impact</th><th>Approver · reason · time</th><th>Status</th><th></th></tr></thead><tbody>${pend}${log.slice().reverse().map((e) => `<tr><td class="num">v${e.version}</td><td>${esc(e.inst)}</td><td>${e.changes.map((c) => `<span class="mono">${esc(c.key)}</span> ${esc(fmtVal(c.key, c.old))} → ${esc(fmtVal(c.key, c.new))}`).join("<br>")}</td><td class="sub2">${impactTxt(e.impact)}</td><td><div>${esc(e.approver)}</div><div class="muted">${esc(e.reason)}</div><div class="muted">${esc(A.londonTime(e.ts))}${e.reverted_at ? " · reverted " + esc(A.londonTime(e.reverted_at)) : ""}</div></td><td>${e.status === "approved" ? '<span class="pill CLOSE">Approved</span>' : '<span class="pill pending" style="opacity:.7">Reverted</span>'}</td><td style="white-space:nowrap">${e.status === "approved" ? `<button class="btn" data-dl="${e.version}">Download</button> <button class="btn" data-rv="${e.version}">Revert</button>` : ""}</td></tr>`).join("") || (pend ? "" : `<tr><td colspan="7" class="muted">No policy changes yet.</td></tr>`)}</tbody></table></div>`;

    main.innerHTML = page(ph("Import", "Run the engine on your own data, in your browser. Nothing is uploaded.") + `
      <div class="grid g2" style="margin-bottom:20px">
        <div class="card" id="drop"><h2>Bring your data</h2><p class="hint">An institution folder (cases.jsonl, alerts.jsonl, customers.jsonl, transactions.jsonl, evidence/…), a .zip of one, or engine output (.jsonl, .trace.jsonl, .csv) to view.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="pickDir">Choose folder…</button><button class="btn" id="pickZip">Choose .zip / .jsonl / .csv…</button></div>
          <input type="file" id="inDir" webkitdirectory multiple class="hide"><input type="file" id="inZip" accept=".zip,.jsonl,.csv" multiple class="hide">
          <div style="display:flex;gap:10px;align-items:center;margin-top:16px"><span class="note">Or try a sample:</span><select id="sample">${insts.map((i) => `<option value="${i}">${esc(A.instLabel(i))}</option>`).join("")}</select><button class="btn" id="runSample" ${ST.busy ? "disabled" : ""}>Run sample</button></div>
          <p class="note" style="margin-top:14px">Python runs locally through Pyodide (WebAssembly, vendored). The exact system/run file is executed, so the result can be checked byte for byte against the official output.</p></div>
        <div class="card"><h2>Progress</h2><p class="hint">${ST.steps.length ? "" : "Waiting for data."}</p><div class="list">${steps}</div></div>
      </div>
      <div class="stack">${res}${wf}${diff}${appr}${logHtml}</div>`);

    // wiring
    const run = (fn) => async (...a) => { if (ST.busy) return; ST.busy = true; try { await fn(...a); } catch (err) { console.warn(err); failStep(err.message); } finally { ST.busy = false; A.route(); } };
    const $ = (s) => main.querySelector(s);
    $("#pickDir").onclick = () => $("#inDir").click();
    $("#pickZip").onclick = () => $("#inZip").click();
    $("#inDir").onchange = run(async (e) => importFiles(Array.from(e.target.files || [])));
    $("#inZip").onchange = run(async (e) => importFiles(Array.from(e.target.files || [])));
    $("#runSample").onclick = run(async () => {
      const inst = $("#sample").value;
      startSteps(); const s = step("Fetch sample data/inst/" + inst + ".zip");
      const r = await fetch("data/inst/" + inst + ".zip"); if (!r.ok) throw new Error("sample not found (" + r.status + ")");
      const buf = new Uint8Array(await r.arrayBuffer()); done(s, (buf.length / 1e6).toFixed(1) + " MB");
      await runFolderFromZip(buf, inst + ".zip");
    });
    const drop = $("#drop");
    drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = "var(--accent)"; };
    drop.ondragleave = () => (drop.style.borderColor = "");
    drop.ondrop = run(async (e) => { e.preventDefault(); drop.style.borderColor = ""; await importFiles(await droppedFiles(e.dataTransfer)); });
    if ($("#openQ")) { $("#openQ").onclick = async () => { await A.setInst(sess.key); A.go("#/queue"); }; $("#openO").onclick = async () => { await A.setInst(sess.key); A.go("#/"); }; }
    if ($("#runWI")) {
      const readDraft = () => { const o = {}; main.querySelectorAll("input[data-k]").forEach((i) => (o[i.dataset.k] = i.value === "" ? null : Number(i.value))); return o; };
      $("#runWI").onclick = run(async () => whatIf(readDraft()));
      $("#resetWI").onclick = () => { ST.whatif = null; A.route(); };
    }
    main.querySelectorAll("tr.row[data-id]").forEach((tr) => (tr.onclick = async () => { if (!ST.whatif || !ST.whatif.data) return; await A.setInst(ST.whatif.key); A.go("#/case/" + tr.dataset.id); }));
    if ($("#apBtn")) {
      const chk = () => ($("#apBtn").disabled = !($("#apName").value.trim() && $("#apReason").value.trim() && W.changes.length));
      $("#apName").oninput = chk; $("#apReason").oninput = chk;
      $("#apBtn").onclick = () => approve($("#apName").value.trim(), $("#apReason").value.trim());
    }
    if ($("#dlNow")) $("#dlNow").onclick = () => download("policy-overrides.json", overrideDoc(W.approved));
    main.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => { const e = readLog().find((x) => String(x.version) === b.dataset.dl); if (e) download("policy-overrides.json", overrideDoc(e)); }));
    main.querySelectorAll("[data-rv]").forEach((b) => (b.onclick = () => { const l = readLog(); const e = l.find((x) => String(x.version) === b.dataset.rv); if (!e) return; e.status = "reverted"; e.reverted_at = new Date().toISOString(); writeLog(l); if (ST.whatif && ST.whatif.approved && ST.whatif.approved.version === e.version) ST.whatif.approved = null; A.route(); }));

    /* ----- steps ----- */
    function startSteps() { ST.steps = []; }
    function step(label) { const s = { label, state: "run", t0: performance.now() }; ST.steps.push(s); paintSteps(); return s; }
    function done(s, note) { s.state = "done"; s.ms = performance.now() - s.t0; if (note) s.note = note; paintSteps(); }
    function failStep(msg) { const s = ST.steps[ST.steps.length - 1]; if (s && s.state === "run") { s.state = "err"; s.note = msg; } else ST.steps.push({ label: "Failed", state: "err", note: msg }); }
    function paintSteps() {
      const box = main.querySelector(".g2 .card:nth-child(2) .list"); if (!box) return;
      box.innerHTML = ST.steps.map((s) => `<div class="li"><div><div class="t">${s.state === "done" ? '<span style="color:var(--close)">✓</span>' : s.state === "err" ? '<span style="color:var(--esc)">✕</span>' : "…"} ${esc(s.label)}</div>${s.note ? `<div class="d">${esc(s.note)}</div>` : ""}</div><div class="num note">${s.ms != null ? (s.ms / 1000).toFixed(1) + " s" : ""}</div></div>`).join("");
    }

    /* ----- import ----- */
    async function droppedFiles(dt) {
      const out = [];
      const walk = (entry, path) => new Promise((res) => {
        if (entry.isFile) entry.file((f) => { Object.defineProperty(f, "pgPath", { value: path + f.name }); out.push(f); res(); });
        else { const rd = entry.createReader(); const all = []; const more = () => rd.readEntries(async (es) => { if (!es.length) { for (const e of all) await walk(e, path + entry.name + "/"); res(); } else { all.push(...es); more(); } }); more(); }
      });
      const items = Array.from(dt.items || []).map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      if (!items.length) return Array.from(dt.files || []);
      for (const it of items) await walk(it, "");
      return out;
    }
    async function importFiles(files) {
      if (!files.length) return;
      startSteps();
      const zip = files.find((f) => /\.zip$/i.test(f.name));
      if (zip) { const s = step("Read " + zip.name); const buf = new Uint8Array(await zip.arrayBuffer()); done(s); return runFolderFromZip(buf, zip.name); }
      const rel = (f) => f.pgPath || f.webkitRelativePath || f.name;
      if (files.some((f) => /(^|\/)cases\.jsonl$/.test(rel(f)))) {
        const s = step(`Load ${files.length} files`);
        const p = await pyWithStep();
        try { p.FS.rmdir; p.runPython("import shutil; shutil.rmtree('/in', ignore_errors=True)"); } catch (_) {}
        for (const f of files) {
          const path = "/in/" + rel(f).replace(/^\/+/, "");
          p.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
          p.FS.writeFile(path, new Uint8Array(await f.arrayBuffer()));
        }
        done(s);
        return runFolder(p, rel(files[0]).split("/")[0] || "folder");
      }
      return viewOnly(files);
    }
    async function pyWithStep() {
      if (PY) return py();
      const s = step("Start Python in the browser (Pyodide)"); await tick();
      const p = await py(); done(s, "Python " + p.runPython("import sys; sys.version.split()[0]")); return p;
    }
    async function runFolderFromZip(buf, name) {
      const p = await pyWithStep();
      const s = step("Unpack " + name); await tick();
      p.runPython("import shutil; shutil.rmtree('/in', ignore_errors=True)");
      p.FS.mkdirTree("/in"); p.FS.writeFile("/in/upload.zip", buf);
      pyCall(p, "pg_unzip", "/in/upload.zip", "/in/x");
      done(s);
      return runFolder(p, name.replace(/\.zip$/i, ""));
    }
    async function runFolder(p, name) {
      const folder = pyCall(p, "pg_find_root", "/in");
      if (!folder) throw new Error("No cases.jsonl found in the upload");
      const inst = pyCall(p, "pg_inst", folder);
      const s = step(`Run system/run on ${inst}`); await tick();
      const t0 = performance.now();
      const r = JSON.parse(pyCall(p, "pg_run", folder, "/pg/out.jsonl", ""));
      const ms = performance.now() - t0;
      done(s, `${r.n} cases · ${r.stderr.trim()}`);
      const s2 = step("Build the queue and case pages"); await tick();
      const data = JSON.parse(pyCall(p, "pg_bundle", inst, folder, "/pg/out.jsonl", 200, "[]"));
      data.runs = [{ run: 1, verdict_code_hash: r.verdict_code_hash, file_hash: r.file_hash }];
      done(s2, `${Object.keys(data.detail).length} case pages`);
      const key = "import:" + inst;
      window.PROOF_DATA[key] = data; A.S.extra[key] = { label: "Imported · " + (A.instLabel(inst) || inst) };
      ST.session = { key, inst, label: name, folder, rows: data.rows, data, ms, file_hash: r.file_hash, base: r.rows, baseHash: r.verdict_code_hash };
      ST.whatif = null;
      A.renderSide();
    }
    async function viewOnly(files) {
      const s = step("Read engine output");
      const traces = {}, outs = {};
      for (const f of files) {
        const txt = await f.text();
        if (/\.csv$/i.test(f.name)) {
          const lines = txt.split(/\r?\n/).filter((l) => l.trim()); const hdr = splitCsv(lines.shift()).map((h) => h.trim());
          lines.forEach((l) => { const v = splitCsv(l); const o = Object.fromEntries(hdr.map((h, i) => [h, v[i]])); if (o.case_id) outs[o.case_id] = { case_id: o.case_id, alert_ids: (o.alert_ids || "").split(/[;| ]+/).filter(Boolean), verdict: o.verdict, reason_code: o.reason_code, reason: o.reason || "", evidence: (o.evidence || "").split(/[;| ]+/).filter(Boolean) }; });
        } else txt.split("\n").filter((l) => l.trim()).forEach((l) => { try { const o = JSON.parse(l); if (o.nodes) traces[o.case_id] = o; else if (o.reason_code) outs[o.case_id] = o; } catch (_) {} });
      }
      const ids = Object.keys(outs);
      if (!ids.length) throw new Error("No institution folder (cases.jsonl) and no engine output rows found");
      const rows = ids.map((id) => { const o = outs[id], t = traces[id]; const cust = t && t.nodes.find((n) => n.type === "customer");
        return { id, name: cust ? cust.label : "", rules: t ? t.nodes.filter((n) => n.type === "alert").map((n) => n.label) : [], amount: t ? (t.reconciliation || []).reduce((a, r) => a + (r.alerted_gbp || 0), 0) : 0, verdict: o.verdict, code: o.reason_code, alerts: (o.alert_ids || []).length, detail: false, reason: o.reason, evidence: o.evidence || [], alert_ids: o.alert_ids || [], fired: t ? [...new Set(t.firings.filter((f) => !f.advisory).map((f) => f.rule.replace(/^R_TM22_.*/, "R_TM22")))] : [] }; });
      const key = "import:output";
      window.PROOF_DATA[key] = { inst: key, rows, detail: {}, demos: {}, runs: [] }; A.S.extra[key] = { label: "Imported output" };
      ST.session = { key, inst: "output", label: files.map((f) => f.name).join(", "), folder: null, rows, data: window.PROOF_DATA[key], ms: 0, file_hash: "n/a" };
      done(s, `${rows.length} cases (view only: no folder, so no re-run or what-if)`);
      A.renderSide();
    }
    function splitCsv(l) { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; }

    /* ----- what-if ----- */
    async function whatIf(draft) {
      const S0 = ST.session, p = await py();
      const d = defaults(S0.inst), act = activeFor(S0.inst);
      const cur = Object.assign({}, d, act ? act.overrides : {});
      const overrides = {}; Object.keys(keys()).forEach((k) => { if (k in draft && draft[k] !== (d[k] == null ? null : d[k])) overrides[k] = draft[k]; });
      const changes = Object.keys(keys()).filter((k) => k in draft && draft[k] !== (cur[k] == null ? null : cur[k])).map((k) => ({ key: k, old: cur[k] == null ? null : cur[k], new: draft[k] }));
      startSteps();
      // baseline = the currently active policy (defaults unless an approved version exists)
      let base = S0.base;
      if (act) { const sb = step(`Re-run with the active policy v${act.version}`); await tick(); base = JSON.parse(pyCall(p, "pg_run", S0.folder, "/pg/active.jsonl", JSON.stringify(overrideDoc(act)))).rows; done(sb); }
      const s = step("Re-run every case with the proposed settings"); await tick();
      const doc = { schema: "poligraph.policy-overrides/1", institution: S0.inst, overrides };
      const r = JSON.parse(pyCall(p, "pg_run", S0.folder, "/pg/whatif.jsonl", JSON.stringify(doc)));
      done(s, r.stderr.trim().split("\n")[0]);
      const bm = Object.fromEntries(base.map((x) => [x[0], x]));
      const changed = [], transitions = {}; let changedCode = 0;
      r.rows.forEach(([id, v, c]) => { const b = bm[id]; if (!b) return; if (b[1] !== v) { changed.push([id, b[1], v, c]); const k = `${b[1]} → ${v}`; transitions[k] = (transitions[k] || 0) + 1; } else if (b[2] !== c) changedCode++; });
      const cb = counts(base.map((x) => ({ verdict: x[1] }))), ca = counts(r.rows.map((x) => ({ verdict: x[1] })));
      const impact = { changed: changed.length, transitions, before: { CLOSE: cb.CLOSE, RFI: cb.RFI, ESCALATE: cb.ESCALATE }, after: { CLOSE: ca.CLOSE, RFI: ca.RFI, ESCALATE: ca.ESCALATE } };
      ST.whatif = { draft, overrides, changes, base, result: r.rows, changed, changedCode, transitions, impact, approved: null, data: null, key: "whatif:" + S0.inst };
      A.route(); await tick();
      const s2 = step("Build case pages under the new policy"); await tick();
      const data = JSON.parse(pyCall(p, "pg_bundle", S0.inst, S0.folder, "/pg/whatif.jsonl", 120, JSON.stringify(changed.slice(0, 150).map((x) => x[0]))));
      data.runs = [];
      window.PROOF_DATA[ST.whatif.key] = data; A.S.extra[ST.whatif.key] = { label: "What-if · " + A.instLabel(S0.inst) };
      ST.whatif.data = data; done(s2); A.renderSide();
    }
    function approve(name, reason) {
      const W0 = ST.whatif, l = readLog();
      const e = { version: l.reduce((m, x) => Math.max(m, x.version), 0) + 1, inst: ST.session.inst, changes: W0.changes, overrides: W0.overrides,
        approver: name, reason, ts: new Date().toISOString(), impact: W0.impact, status: "approved" };
      l.push(e); writeLog(l); W0.approved = e;
      A.route();
    }
  };
  function impactTxt(im) {
    if (!im) return "";
    const t = Object.entries(im.transitions || {}).map(([k, n]) => `${k} ${n}`).join(", ");
    return `${im.changed} verdict${im.changed === 1 ? "" : "s"} change${t ? " · " + t : ""}`;
  }
})();
