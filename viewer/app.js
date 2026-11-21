/* PROOF analyst workbench: static, offline. Data: window.PROOF_DATA[inst] (built by build_data.py). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const gbp = (x) => "£" + Number(x || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp0 = (x) => "£" + Math.round(Number(x || 0)).toLocaleString("en-GB");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const ONTO = window.PROOF_ONTOLOGY || { nodeClass: {}, docClass: {}, edgeProp: {}, tree: "" };

  const S = { inst: null, data: null, rows: [], visible: [], sel: null, filter: { v: "ALL", rule: "", code: "", q: "", detailOnly: false },
    replay: null, decided: null, cy: null, hoverLock: false };

  /* ---------- institution loading (lazy <script> so file:// works) ---------- */
  const INSTS = window.PROOF_INSTS || [];
  const LABEL = { bank: "Bank", emoney: "E-money", investment: "Investment", payments_fx: "Payments/FX", upload: "Uploaded" };
  function loadInst(inst) {
    stopReplay();
    if (window.PROOF_DATA && window.PROOF_DATA[inst]) return useInst(inst);
    const s = document.createElement("script");
    s.src = "data/" + inst + ".js";
    s.onload = () => useInst(inst);
    s.onerror = () => toastEmpty("Could not load data/" + inst + ".js — run viewer/build_data.py");
    document.body.appendChild(s);
  }
  function renderInstSeg() {
    const seg = $("#instSeg");
    const list = INSTS.slice();
    if (window.PROOF_DATA && window.PROOF_DATA.upload) list.push("upload");
    seg.innerHTML = list.map((i) => `<button data-i="${i}" class="${i === S.inst ? "on" : ""}">${LABEL[i] || i}</button>`).join("");
    $$("button", seg).forEach((b) => (b.onclick = () => loadInst(b.dataset.i)));
  }
  function useInst(inst) {
    S.inst = inst;
    S.data = window.PROOF_DATA[inst];
    S.rows = S.data.rows;
    S.decided = null;
    renderInstSeg();
    buildFilters();
    renderBadge();
    renderPins();
    applyFilter();
    updateCounters();
    const first = S.data.demos && (S.data.demos.close || S.data.demos.esc);
    if (first) openCase(first);
    else if (S.rows.length) openCase(S.rows[0].id);
  }
  function toastEmpty(msg) { $("#gEmpty").textContent = msg; $("#gEmpty").classList.remove("hide"); }

  /* ---------- header: counters + badge ---------- */
  function counts(rows) {
    const c = { n: rows.length, CLOSE: 0, RFI: 0, ESCALATE: 0, closedAlerts: 0 };
    rows.forEach((r) => { c[r.verdict]++; if (r.verdict === "CLOSE") c.closedAlerts += r.alerts || 1; });
    return c;
  }
  let ctrAnim = {};
  function setNum(id, v, fmt) {
    const el = $(id); const from = ctrAnim[id] || 0; ctrAnim[id] = v;
    if (from === v) { el.textContent = fmt(v); return; }
    const t0 = performance.now(), d = 220;
    const step = (t) => { const k = Math.min(1, (t - t0) / d); el.textContent = fmt(from + (v - from) * k); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function updateCounters() {
    const rows = S.decided || S.rows;
    const c = counts(rows);
    const n = (x) => Math.round(x).toLocaleString("en-GB");
    setNum("#cDecided", c.n, n); setNum("#cClose", c.CLOSE, n); setNum("#cRfi", c.RFI, n); setNum("#cEsc", c.ESCALATE, n);
    setNum("#cHours", (c.closedAlerts * 20) / 60, (x) => x.toLocaleString("en-GB", { maximumFractionDigits: 0 }));
    $("#qsplit").textContent = `${c.CLOSE} · ${c.RFI} · ${c.ESCALATE}`;
  }
  function renderBadge() {
    const runs = (S.data && S.data.runs) || [];
    const b = $("#badge");
    const hs = new Set(runs.map((r) => r.verdict_code_hash));
    const ok = runs.length > 1 && hs.size === 1;
    b.classList.toggle("bad", runs.length > 1 && !ok);
    $("#badgeT").textContent = runs.length ? `${ok ? runs.length : runs.length - hs.size + 1}/${runs.length} identical runs ${ok ? "🔒" : "⚠"}` : "1 run loaded";
    $("#badgeH").textContent = runs.length ? `${runs[0].verdict_code_hash.slice(0, 7)}  verdict+code` : "no repeat runs in file";
    $("#badgePop").innerHTML = runs.length ? `<div class="label">Five independent runs of system/run</div><table><tr><th>run</th><th>verdict+code hash</th><th>file sha256</th></tr>${runs
      .map((r) => `<tr><td>${r.run}</td><td>${r.verdict_code_hash}</td><td>${r.file_hash}</td></tr>`).join("")}</table><p class="note">Hashes cover every case's verdict and reason code, and the whole output file byte for byte.</p>` : "";
  }
  $("#badge").onclick = (e) => { if (!e.target.closest(".pop")) $("#badge").classList.toggle("open"); };

  /* ---------- queue ---------- */
  function buildFilters() {
    const rules = [...new Set(S.rows.flatMap((r) => r.rules))].sort();
    const codes = [...new Set(S.rows.map((r) => r.code))].sort();
    $("#ruleSel").innerHTML = `<option value="">All rules</option>` + rules.map((r) => `<option>${r}</option>`).join("");
    $("#codeSel").innerHTML = `<option value="">All reason codes</option>` + codes.map((r) => `<option>${r}</option>`).join("");
    S.filter.rule = ""; S.filter.code = "";
  }
  function rowHTML(r, pin) {
    return `<div class="row ${r.verdict}${r.detail ? "" : " nodetail"}${S.sel === r.id ? " sel" : ""}" data-id="${r.id}" tabindex="-1">
      <div><div class="id">${pin ? '<span class="star">★</span>' : ""}${r.id}</div><div class="nm">${esc(r.name)}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="vchip ${r.verdict}">${r.verdict === "ESCALATE" ? "ESC" : r.verdict}</span><span class="meta">${r.rules[0] || ""} · ${gbp0(r.amount)}</span></div>
      <div class="code">${pin ? pin + " · " : ""}${r.code}${r.detail ? "" : " · summary only"}</div></div>`;
  }
  function renderPins() {
    const d = (S.data && S.data.demos) || {};
    const lab = { close: "clean close · £0 unexplained", esc: "escalate trap", rfi: "RFI · amber remainder" };
    const byId = Object.fromEntries(S.rows.map((r) => [r.id, r]));
    $("#pins").innerHTML = `<span class="label">★ Demo cases</span>` + ["close", "esc", "rfi"].filter((k) => d[k] && byId[d[k]]).map((k) => rowHTML(byId[d[k]], lab[k])).join("");
    $$("#pins .row").forEach((el) => (el.onclick = () => openCase(el.dataset.id)));
  }
  function matches(r) {
    const f = S.filter;
    if (f.v !== "ALL" && r.verdict !== f.v) return false;
    if (f.rule && !r.rules.includes(f.rule)) return false;
    if (f.code && r.code !== f.code) return false;
    if (f.detailOnly && !r.detail) return false;
    if (f.q) { const q = f.q.toLowerCase(); if (!r.id.toLowerCase().includes(q) && !(r.name || "").toLowerCase().includes(q)) return false; }
    return true;
  }
  function applyFilter() {
    const src = S.decided || S.rows;
    S.visible = src.filter(matches);
    if (S.replay) S.visible = S.visible.slice().reverse();
    const MAX = 600;
    $("#qlist").innerHTML = S.visible.slice(0, MAX).map((r) => rowHTML(r)).join("") + (S.visible.length > MAX ? `<div class="note" style="padding:10px 12px">+${S.visible.length - MAX} more — refine the filter</div>` : "");
    $("#qcount").textContent = `${S.visible.length} shown`;
  }
  $("#qlist").addEventListener("click", (e) => { const el = e.target.closest(".row"); if (el) openCase(el.dataset.id); });
  $$("#vchips .chip").forEach((b) => (b.onclick = () => { $$("#vchips .chip").forEach((x) => x.classList.toggle("on", x === b)); S.filter.v = b.dataset.v; applyFilter(); }));
  $("#ruleSel").onchange = (e) => { S.filter.rule = e.target.value; applyFilter(); };
  $("#codeSel").onchange = (e) => { S.filter.code = e.target.value; applyFilter(); };
  $("#search").oninput = (e) => { S.filter.q = e.target.value.trim(); applyFilter(); };
  $("#detailOnly").onchange = (e) => { S.filter.detailOnly = e.target.checked; applyFilter(); };
  function markSel() {
    $$(".row").forEach((el) => el.classList.toggle("sel", el.dataset.id === S.sel));
    const el = $(`#qlist .row[data-id="${S.sel}"]`);
    if (el && !S.replay) el.scrollIntoView({ block: "nearest" });
  }

  /* ---------- replay ---------- */
  const speed = () => Number($("#speed").value);
  $("#speed").oninput = () => { $("#speedV").textContent = speed() + "/s"; if (S.replay) { clearInterval(S.replay.timer); S.replay.timer = setInterval(tick, 1000 / speed()); } };
  function tick() {
    const R = S.replay; if (!R) return;
    if (R.i >= S.rows.length) return stopReplay();
    const r = S.rows[R.i++];
    S.decided.push(r);
    updateCounters();
    if (matches(r)) {
      const tmp = document.createElement("div"); tmp.innerHTML = rowHTML(r);
      const el = tmp.firstElementChild; el.classList.add("enter");
      $("#qlist").prepend(el);
      const rows = $$("#qlist .row"); if (rows.length > 400) rows[rows.length - 1].remove();
      $("#qcount").textContent = `${S.decided.filter(matches).length} shown`;
    }
    const now = performance.now();
    if (R.follow && r.detail && now - (R.last || 0) > 1400) { R.last = now; openCase(r.id, true); }
  }
  function startReplay() {
    S.decided = []; ctrAnim = {}; $("#qlist").innerHTML = ""; updateCounters();
    S.replay = { i: 0, timer: setInterval(tick, 1000 / speed()), follow: true, last: 0 };
    $("#replayBtn").classList.add("live"); $("#replayBtn").textContent = "Stop replay";
  }
  function stopReplay() {
    if (!S.replay) return;
    clearInterval(S.replay.timer); S.replay = null;
    $("#replayBtn").classList.remove("live"); $("#replayBtn").textContent = "▶ Replay queue";
    applyFilter();
  }
  $("#replayBtn").onclick = () => (S.replay ? stopReplay() : startReplay());

  /* ---------- open a case ---------- */
  function caseData(id) { return S.data.detail[id] || null; }
  function rowOf(id) { return S.rows.find((r) => r.id === id); }
  function openCase(id, quiet) {
    S.sel = id; markSel();
    const d = caseData(id), r = rowOf(id);
    closeDoc();
    renderRight(r, d);
    renderGraph(r, d, quiet);
    renderTimeline(d);
  }

  /* ---------- ontology labels ---------- */
  function docClass(t) { return ONTO.docClass[t] || "Document"; }
  function nodeClass(n, d) {
    if (n.type === "document") return docClass(n.label);
    if (n.type === "record") return /-R\d/.test(n.id) ? "PriorReview" : "Transaction";
    return ONTO.nodeClass[n.type] || n.type;
  }
  const prop = (rel) => ONTO.edgeProp[rel] || rel;
  const RULE_TEXT = {
    X1_document_reconciles: ["Document reconciles", "A document states the transaction's exact amount and names the party or the customer."],
    X2_own_account_statement: ["Own account proven", "A statement names the customer as holder of the counterparty account (last 4 digits match)."],
    X3_group_collection: ["Group collection", "Every payer is on the booking's traveller list and the payout equals the booking."],
    X4_group_company: ["Group company", "Group structure shows the counterparty and the customer share an owner."],
    X5_cash_redeposited: ["Cash re-deposited", "Chat + an earlier withdrawal of the same amount + a prior review of that withdrawal."],
    X6_redemption_reason_documented: ["Redemption reason documented", "Redundancy letter plus the customer's sell request."],
    R_CLOSE: ["Close", "Every alert reconciles to evidence and no suspicion rule fired."],
    R_RFI: ["Request information", "An alert is still open: ask for the specific missing document."],
    R_OWN_ACCOUNT_PROFILE_UPDATE: ["Profile update (≥5x)", "Own-account money, but activity is ≥5x the declared profile."],
    R_KEYWORD_SUSPICION: ["Suspicion keyword", "Unreconciled activity plus a fraud/mule/crypto indicator in the documents."],
  };
  function ruleText(label) {
    if (RULE_TEXT[label]) return RULE_TEXT[label];
    let m = label.match(/^R_RECONCILE_(TM\d+)/); if (m) return ["Reconcile " + m[1], `Alerted pounds for ${m[1]} minus pounds explained by evidence, against the threshold that made ${m[1]} fire.`];
    m = label.match(/^R_TM22_(.*)/); if (m) return ["List match · " + m[1].replace(/_/g, " "), "Resolve the internal-list match: same party (escalate), different party (clear) or unsettled (ask)."];
    m = label.match(/^S\d+_(.*)/); if (m) return [m[1].replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), "Suspicion rule: when its facts hold, the case escalates regardless of other documents."];
    return [label.replace(/_/g, " "), ""];
  }

  /* ---------- graph ---------- */
  const COL = { customer: 0, alert: 1, transaction: 2, document: 3, record: 3, list_entry: 3, rule: 4, verdict: 5 };
  const ABBR = { bank_statement: "STM", invoice: "INV", supplier_invoice: "INV", supplier_invoices: "INV", receipt: "RCT", company_register_extract: "REG", significant_control_register: "PSC", gift_letter: "GFT", support_chat: "CHT", staff_note: "NTE", due_diligence_summary: "KYC", proof_of_address: "POA", contact_note: "NTE" };
  function txLabel(id, d) {
    const t = d && d.timeline.find((x) => x.id === id);
    return t ? `${gbp0(t.amt)} ${t.dir === "in" ? "in" : "out"}` : id;
  }
  function graphElements(r, d) {
    const tr = d.trace, nodes = [], edges = [];
    const verdict = d.out.verdict;
    const ids = new Set();
    const cited = new Set(d.out.evidence);
    tr.nodes.forEach((n) => {
      ids.add(n.id);
      let label = n.label || n.id, type = n.type, cls = nodeClass(n, d), extra = "";
      if (type === "customer") label = n.label;
      if (type === "alert") label = `${n.label}\n${n.id}`;
      if (type === "transaction" || (type === "record" && cls === "Transaction")) { type = "transaction"; label = `${txLabel(n.id, d)}\n${n.id}`; }
      if (type === "document") { label = `${n.id}\n${cls}`; if (/^(due_diligence_summary|proof_of_address|contact_note)$/.test(n.label)) extra = " boiler"; }
      if (type === "list_entry") label = `${n.label}\n${n.id}`;
      if (type === "rule") { label = ruleText(n.label)[0]; const f = tr.firings[Number(n.id.slice(1)) - 1]; if (f && f.advisory) { label += "\n(advisory)"; extra = " advisory"; } }
      if (type === "verdict") label = `${verdict}\n${d.out.reason_code}`;
      if (type === "record" && cls === "PriorReview") type = "document";
      nodes.push({ data: { id: n.id, label, type, cls, raw: n, col: COL[type] ?? 3, cited: cited.has(n.id) ? 1 : 0 }, classes: type + extra + (type === "verdict" ? " " + verdict : "") + (cited.has(n.id) ? " cited" : "") });
    });
    const seen = new Set();
    tr.edges.forEach((e, i) => {
      if (!ids.has(e.from) || !ids.has(e.to)) return;
      const k = e.from + "|" + e.to + "|" + e.rel; if (seen.has(k)) return; seen.add(k);
      edges.push({ data: { id: "e" + i, source: e.from, target: e.to, rel: e.rel, label: prop(e.rel) }, classes: e.rel });
    });
    // unlinked documents hang off the customer (hasEvidence) so they sit in the document column
    const linked = new Set(); edges.forEach((e) => { linked.add(e.data.source); linked.add(e.data.target); });
    nodes.forEach((n) => { if (!linked.has(n.data.id) && n.data.type !== "customer") edges.push({ data: { id: "h" + n.data.id, source: tr.nodes[0].id, target: n.data.id, rel: "holds", label: prop("holds") }, classes: "holds" }); });
    return nodes.concat(edges);
  }
  function cyStyle() {
    const c = (v) => css(v);
    const node = (sel, col, shape, w, h) => ({ selector: sel, style: { shape, "background-color": col, "background-opacity": 0.18, "border-color": col, "border-width": 1.5, width: w, height: h } });
    return [
      { selector: "node", style: { label: "data(label)", color: c("--text"), "font-family": "Plex Sans", "font-size": 10, "text-wrap": "wrap", "text-max-width": 130, "text-valign": "bottom", "text-margin-y": 5, "min-zoomed-font-size": 6, "transition-property": "opacity, border-width", "transition-duration": "160ms" } },
      node("node.customer", c("--node-customer"), "ellipse", 46, 46),
      node("node.alert", c("--node-alert"), "triangle", 36, 32),
      node("node.transaction", c("--node-transaction"), "diamond", 30, 30),
      node("node.document", c("--node-document"), "round-rectangle", 30, 38),
      node("node.list_entry", c("--node-list"), "octagon", 36, 36),
      node("node.rule", c("--node-rule"), "hexagon", 40, 34),
      { selector: "node.verdict", style: { shape: "round-rectangle", width: 120, height: 40, "text-valign": "center", "text-margin-y": 0, "font-family": "Plex Mono", "font-size": 10.5, "font-weight": 500, "background-opacity": 0.16, "border-width": 2 } },
      { selector: "node.verdict.CLOSE", style: { "background-color": c("--close"), "border-color": c("--close"), color: c("--close") } },
      { selector: "node.verdict.RFI", style: { "background-color": c("--rfi"), "border-color": c("--rfi"), color: c("--rfi") } },
      { selector: "node.verdict.ESCALATE", style: { "background-color": c("--escalate"), "border-color": c("--escalate"), color: c("--escalate") } },
      { selector: "node.document, node.transaction, node.alert, node.list_entry", style: { "font-family": "Plex Mono", "font-size": 9.5 } },
      { selector: "node.boiler", style: { opacity: 0.45 } },
      { selector: "node.advisory", style: { "border-style": "dashed", "background-opacity": 0.06 } },
      { selector: "node.cited", style: { "border-width": 2.2 } },
      { selector: "edge", style: { width: 1.5, "curve-style": "bezier", "line-color": c("--edge-covers"), "target-arrow-color": c("--edge-covers"), "target-arrow-shape": "triangle", "arrow-scale": 0.8, label: "", "font-size": 8.5, "font-family": "Plex Mono", color: c("--text-dim"), "text-background-color": c("--bg"), "text-background-opacity": 0.85, "text-background-padding": 2, "text-rotation": "autorotate", "transition-property": "opacity, line-color, width", "transition-duration": "160ms", opacity: 0.85 } },
      { selector: "edge.fired_on", style: { "line-color": c("--edge-fired"), "target-arrow-color": c("--edge-fired"), "line-style": "dashed", "line-dash-pattern": [5, 4], width: 1.3, opacity: 0.7 } },
      { selector: "edge.supports, edge.explains, edge.matches", style: { "line-color": c("--edge-supports"), "target-arrow-color": c("--edge-supports"), width: 1.8, opacity: 0.75 } },
      { selector: "edge.explains", style: { label: "data(label)" } },
      { selector: "edge.matches", style: { label: "data(label)", "line-style": "dotted" } },
      { selector: "edge.contradicts", style: { "line-color": c("--edge-contradicts"), "target-arrow-color": c("--edge-contradicts"), width: 2.6, label: "data(label)", color: c("--escalate"), opacity: 1, "line-style": "dashed", "line-dash-pattern": [8, 3] } },
      { selector: "edge.samecol", style: { "curve-style": "unbundled-bezier", "control-point-distances": [-70], "control-point-weights": [0.5] } },
      { selector: "edge.holds", style: { width: 1, "target-arrow-shape": "none", opacity: 0.35 } },
      { selector: ".dim", style: { opacity: 0.18 } },
      { selector: "edge.contradicts.dim", style: { opacity: 0.55 } },
      { selector: ".hl", style: { opacity: 1 } },
      { selector: "edge.hl", style: { label: "data(label)", width: 2.4 } },
      { selector: "node:selected, node.picked", style: { "overlay-color": c("--focus"), "overlay-opacity": 0.12, "overlay-padding": 6, "border-color": c("--focus"), "border-width": 2.5 } },
    ];
  }
  function ensureCy() {
    if (S.cy) return S.cy;
    S.cy = cytoscape({ container: $("#cy"), style: cyStyle(), minZoom: 0.2, maxZoom: 3, boxSelectionEnabled: false, autoungrabify: false });
    const cy = S.cy;
    cy.on("mouseover", "node", (e) => hoverNode(e.target, e.renderedPosition));
    cy.on("mouseout", "node", () => { if (!S.hoverLock) clearHover(); hideTip(); });
    cy.on("tap", "node", (e) => clickNode(e.target));
    cy.on("tap", (e) => { if (e.target === cy) { cy.$(".picked").removeClass("picked"); $("#gSel").textContent = ""; } });
    return cy;
  }
  function renderGraph(r, d, quiet) {
    const cy = ensureCy();
    $("#gTitle").textContent = r ? r.id : ""; $("#gSub").textContent = r ? `${r.name} · ${r.rules.join(" + ")}` : "";
    if (!d) { cy.elements().remove(); toastEmpty(r ? "Summary-only case: its graph isn't in this bundle. Rebuild with  python3 viewer/build_data.py --detail 1000  to include every case." : "Select a case."); return; }
    $("#gEmpty").classList.add("hide");
    cy.batch(() => { cy.elements().remove(); cy.add(graphElements(r, d)); });
    const layEdges = cy.edges().filter((e) => e.source().data("col") !== e.target().data("col"));
    cy.edges().difference(layEdges).addClass("samecol");
    const lay = cy.nodes().union(layEdges).layout({
      name: "dagre", rankDir: "LR", nodeSep: 14, rankSep: 90, edgeSep: 8, animate: false, fit: true, padding: 36,
      minLen: (e) => Math.max(1, Math.abs(e.target().data("col") - e.source().data("col"))),
      edgeWeight: (e) => (e.data("rel") === "holds" ? 0.2 : 1),
    });
    // dagre ranks by edge direction; for back-pointing edges (e.g. explains: doc → txn) make it point forward for layout only
    cy.edges().forEach((e) => { if (e.source().data("col") > e.target().data("col")) e.scratch("_flip", 1); });
    lay.run();
    // enforce the ontology column order in x regardless of dagre's ranks
    const xs = {}; cy.nodes().forEach((n) => { const c = n.data("col"); (xs[c] = xs[c] || []).push(n.position("x")); });
    const order = Object.keys(xs).map(Number).sort((a, b) => a - b);
    const gap = 175, PER = 12, sub = 78;
    let x0 = 0;
    order.forEach((c) => {
      const col = cy.nodes().filter((n) => n.data("col") === c).sort((a, b) => a.position("y") - b.position("y"));
      const k = Math.ceil(col.length / PER), rows = Math.ceil(col.length / k);
      const step = c === 4 ? 78 : 72, h = (rows - 1) * step;
      col.forEach((n, i) => n.position({ x: x0 + (i % k) * sub, y: Math.floor(i / k) * step - h / 2 + (i % k) * (k > 1 ? step / 2 : 0) }));
      x0 += gap + (k - 1) * sub;
    });
    cy.fit(cy.elements(), 40);
    if (!quiet) { cy.elements().style("opacity", 0); cy.elements().animate({ style: { opacity: 1 } }, { duration: 240, easing: "ease-out" }); setTimeout(() => cy.elements().removeStyle("opacity"), 300); }
    renderLegend();
  }
  function firingFor(node) {
    const d = caseData(S.sel); if (!d) return null;
    const idx = Number(String(node.id()).replace(/^R/, "")) - 1;
    return d.trace.firings[idx] || null;
  }
  function usedIds(node) {
    const d = caseData(S.sel); const f = firingFor(node); const ids = new Set();
    if (!f) return ids;
    (f.facts || []).forEach((fid) => { const fact = d.trace.facts.find((x) => x.id === fid); if (fact) fact.sources.forEach((s) => ids.add(s)); });
    (f.docs || []).concat(f.txns || []).forEach((x) => ids.add(x));
    if (f.alert) { ids.add(f.alert); const a = d.alerts.find((x) => x.id === f.alert); if (a) a.txns.forEach((t) => ids.add(t)); }
    return ids;
  }
  function hoverNode(n, pos) {
    const cy = S.cy;
    let keep = n.closedNeighborhood();
    let body = "", ids = [];
    const cls = n.data("cls");
    if (n.data("type") === "rule") {
      const used = usedIds(n); ids = [...used];
      used.forEach((id) => { const x = cy.getElementById(id); if (x.nonempty()) keep = keep.union(x).union(x.edgesWith(n)); });
      const f = firingFor(n); const [nm, txt] = ruleText(n.data("raw").label);
      body = `<div class="tt">${esc(nm)} <span class="tchip">${esc(cls)}</span></div><div>${esc(txt)}</div><div class="ids">outcome ${esc(f ? f.outcome : "")}${ids.length ? " · used " + ids.slice(0, 8).join(", ") : ""}</div>`;
    } else {
      body = `<div class="tt">${esc(n.data("label").split("\n")[0])} <span class="tchip">${esc(cls)}</span></div><div class="ids">${esc(n.id())}${n.data("cited") ? " · cited as evidence" : ""}</div>`;
    }
    cy.elements().addClass("dim").removeClass("hl"); keep.removeClass("dim").addClass("hl");
    showTip(body, pos);
  }
  function clearHover() { if (S.cy) S.cy.elements().removeClass("dim hl"); }
  function showTip(html, pos) { const t = $("#tip"); t.innerHTML = html; t.style.left = Math.min(pos.x + 16, $("#cy").clientWidth - 350) + "px"; t.style.top = Math.max(8, pos.y - 10) + "px"; t.classList.add("show"); }
  function hideTip() { $("#tip").classList.remove("show"); }
  function clickNode(n) {
    pick(n.id(), false);
    const t = n.data("type");
    if (t === "document") openDoc(n.id());
    if (t === "transaction") pulseTx(n.id());
  }
  function pick(id, pan) {
    const cy = S.cy; if (!cy) return;
    cy.$(".picked").removeClass("picked");
    const n = cy.getElementById(id);
    if (n.nonempty()) { n.addClass("picked"); if (pan) cy.animate({ center: { eles: n } }, { duration: 200, easing: "ease-out" }); $("#gSel").textContent = `${n.data("cls")} · ${id}`; }
    $$(".evr").forEach((el) => el.classList.toggle("sel", el.dataset.id === id));
    $$(".tlbar").forEach((el) => el.setAttribute("stroke", el.dataset.id === id ? css("--focus") : "none"));
  }
  function renderLegend() {
    const items = [["Customer", "--node-customer"], ["Alert", "--node-alert"], ["Transaction", "--node-transaction"], ["Document", "--node-document"], ["ListEntry", "--node-list"], ["Rule", "--node-rule"]];
    const eds = [["firedOn", "--edge-fired", "dashed"], ["supports · explains", "--edge-supports", "solid"], ["contradicts", "--edge-contradicts", "dashed"], ["hasEvidence", "--edge-covers", "solid"]];
    $("#legend").innerHTML = items.map(([k, v]) => `<span class="li"><span class="sw" style="border-color:${css(v)};background:${css(v)}2e"></span>${k}</span>`).join("") +
      eds.map(([k, v, s]) => `<span class="li"><span class="ln" style="border-top:2px ${s} ${css(v)}"></span>${k}</span>`).join("");
  }
  $("#fitBtn").onclick = () => S.cy && S.cy.animate({ fit: { eles: S.cy.elements(), padding: 40 } }, { duration: 200 });
  $("#pngBtn").onclick = () => { if (!S.cy) return; const a = document.createElement("a"); a.href = S.cy.png({ full: true, scale: 2, bg: css("--bg") }); a.download = (S.sel || "case") + ".png"; a.click(); };

  /* ---------- right column ---------- */
  function monoize(text) {
    return esc(text).replace(/(£[\d,]+(?:\.\d{2})?|\b[A-Z]{2,4}-[A-Z]{0,3}\d{2,}\b|\b(?:TM\d{2}|RFI_[A-Z_]+|ESC_[A-Z_]+)\b)/g, '<span class="m">$1</span>');
  }
  function evRole(id, d) {
    if (!d) return "";
    const roles = [];
    d.trace.edges.forEach((e) => {
      if (e.from === id && e.rel === "explains") roles.push("explains " + e.to);
      if (e.from === id && e.rel === "contradicts") roles.push("contradicts " + e.to);
      if (e.to === id && e.rel === "contradicts") roles.push("contradicted by " + e.from);
    });
    if (!roles.length) {
      if (d.alerts.some((a) => a.id === id)) { const a = d.alerts.find((x) => x.id === id); return `alert ${a.rule}`; }
      const t = d.timeline.find((x) => x.id === id); if (t) return `${gbp(t.amt)} ${t.dir} · ${t.cp}`;
      const doc = d.docs.find((x) => x.id === id); if (doc) return doc.title || doc.type;
      const le = d.list.find((x) => x.entry_id === id); if (le) return `list entry · ${le.name}`;
      if (id === d.case.held) return "held payment";
    }
    return [...new Set(roles)].slice(0, 2).join(" · ");
  }
  function evType(id, d) {
    if (!d) return "";
    const doc = d.docs.find((x) => x.id === id); if (doc) return docClass(doc.type);
    if (d.alerts.some((a) => a.id === id)) return "Alert";
    if (d.timeline.some((x) => x.id === id)) return "Transaction";
    if (d.list.some((x) => x.entry_id === id)) return "ListEntry";
    if ((d.reviews || []).some((x) => x.review_id === id)) return "PriorReview";
    return "";
  }
  function deciding(d) {
    const s = new Set();
    if (!d) return s;
    d.trace.firings.forEach((f) => { (f.facts || []).forEach((fid) => { const fact = d.trace.facts.find((x) => x.id === fid); if (fact) fact.sources.forEach((x) => s.add(x)); }); (f.docs || []).forEach((x) => s.add(x)); });
    return s;
  }
  function renderRight(r, d) {
    const o = d ? d.out : r ? { verdict: r.verdict, reason_code: r.code, reason: r.reason, evidence: r.evidence } : null;
    if (!o) { $("#right").innerHTML = ""; return; }
    const cust = d ? d.customer : { name: r.name };
    const dec = deciding(d);
    const vcol = { CLOSE: "--close", RFI: "--rfi", ESCALATE: "--escalate" }[o.verdict];
    const evs = o.evidence.slice().sort((a, b) => (dec.has(b) ? 1 : 0) - (dec.has(a) ? 1 : 0));
    const brief = d && d.brief;
    let html = `<div class="sec"><div class="label"><span>Decision</span><span class="mono">${esc(r ? r.id : "")}</span></div>
      <div class="verdict ${o.verdict}"><span class="v">${o.verdict}</span><span class="c">${o.reason_code}</span></div>
      <div class="label" style="margin-top:12px"><span>Reason · official, scored</span></div>
      <div class="reason">${monoize(o.reason)}</div>
      <div class="brief ${brief ? "" : "off"}"><div class="label"><span>Brief · generated from the proof, not used for scoring</span><span>${brief ? esc(brief.source) : "optional"}</span></div>
      <p>${brief ? monoize(brief.text) : "No verified brief for this case. (Optional slot: plain-English summary precomputed offline, fact-checked against the proof.)"}</p></div></div>`;
    if (d) {
      const rc = d.recon, tot = rc.total || 0;
      const explained = rc.segments.filter((s) => s.kind !== "unexplained").reduce((a, s) => a + s.amount, 0);
      const adv = (d.trace.reconciliation || []).some((x) => x.advisory);
      const banner = o.verdict === "ESCALATE" && rc.unexplained === 0 && rc.total > 0 ? `<div class="override">Books balance · escalation overrides — ${o.reason_code}</div>` : o.verdict === "ESCALATE" ? `<div class="override">Suspicion overrides reconciliation — ${o.reason_code}</div>` : "";
      const segs = rc.segments.map((s, i) => `<div class="s ${s.kind}" data-i="${i}" style="flex:${Math.max(s.amount, tot * 0.012)}" title="${s.kind === "doc" ? gbp(s.amount) + " · " + s.doc : s.kind === "profile" ? gbp(s.amount) + " · within profile / threshold" : gbp(s.amount) + " · unexplained"}"></div>`).join("");
      html += `<div class="sec"><div class="label"><span>Reconciliation</span><span>${adv ? "advisory · decided before booking" : "double-entry check, not a score"}</span></div>${banner}
        <div class="recbar" id="recbar">${segs || '<div class="s profile" style="flex:1"></div>'}</div>
        <div class="reccap"><span>Reconciled <b>${gbp(explained)}</b> of <b>${gbp(tot)}</b></span><span class="${rc.unexplained > 0 ? "open" : "ok"}">${gbp(rc.unexplained)} unexplained</span></div>
        <div class="reclegend">${rc.segments.map((s, i) => `<div data-i="${i}"><span><span class="sw" style="border-color:${s.kind === "doc" ? css("--close") : s.kind === "profile" ? "#3A4A60" : css("--rfi")};background:${s.kind === "doc" ? css("--close") : s.kind === "profile" ? "#3A4A60" : css("--rfi")}"></span> ${s.kind === "doc" ? "explained · " + s.doc : s.kind === "profile" ? "within profile / threshold" : "unexplained remainder"}</span><span>${gbp(s.amount)} · ${s.txns.length} txn</span></div>`).join("")}</div>
        <table class="rules">${rc.rule_view.map((x) => `<tr><td>${x.alert}</td><td>${x.rule}</td><td class="n">${gbp0(x.alerted)}</td><td class="n">${x.unexplained ? gbp0(x.unexplained) + " open" : "£0"}</td><td class="${x.cleared ? "ok" : "open"}">${x.cleared ? "cleared" : "open"}</td></tr>`).join("")}</table></div>`;
    }
    html += `<div class="sec"><div class="label"><span>Evidence · cited</span><span>${evs.length} IDs</span></div><div class="ev">${evs
      .map((id) => `<div class="evr" data-id="${id}"><span class="dm" style="color:${dec.has(id) ? css(vcol) : "transparent"}">◆</span><span class="eid">${id}<span class="tchip">${esc(evType(id, d))}</span></span><span class="role">${esc(evRole(id, d))}</span></div>`).join("")}</div></div>`;
    if (d) {
      const c = d.customer, dl = c.declared || {};
      const decl = Object.entries(dl).slice(0, 4).map(([k, v]) => `${esc(k.replace(/_/g, " "))}: <span class="mono">${typeof v === "number" ? gbp0(v) : esc(Array.isArray(v) ? v.join(", ") : v)}</span>`).join(" · ");
      html += `<div class="sec"><div class="label"><span>Customer</span><span class="mono">${esc(c.customer_id)}</span></div><div class="cust"><b>${esc(c.name)}</b> · ${esc(c.kind || "")}${c.employer ? " · " + esc(c.employer) : ""}${c.business_activity ? " · " + esc(c.business_activity) : ""}<br>${decl}</div>
        ${d.case.held ? `<div class="cust" style="margin-top:6px">Held payment <span class="mono">${d.case.held}</span></div>` : ""}</div>`;
    } else {
      html += `<div class="sec note">Summary-only case: rebuild the bundle with --detail 1000 for its graph, reconciliation and documents.</div>`;
    }
    $("#right").innerHTML = html;
    $$(".evr").forEach((el) => (el.onclick = () => evClick(el.dataset.id)));
    $$("#recbar .s, .reclegend div").forEach((el) => (el.onclick = () => segClick(Number(el.dataset.i))));
  }
  function evClick(id) {
    const d = caseData(S.sel); if (!d) return;
    pick(id, true);
    if (d.docs.some((x) => x.id === id)) openDoc(id);
    if (d.timeline.some((x) => x.id === id)) pulseTx(id);
  }
  function segClick(i) {
    const d = caseData(S.sel); if (!d) return; const s = d.recon.segments[i]; if (!s) return;
    pulseSeg(i);
    if (s.txns[0]) pick(s.txns[0], true);
    if (s.doc) openDoc(s.doc);
  }
  function pulseSeg(i) { const el = $(`#recbar .s[data-i="${i}"]`); if (el) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); } }
  function pulseTx(id) {
    const d = caseData(S.sel); if (!d) return;
    const i = d.recon.segments.findIndex((s) => s.txns.includes(id)); if (i >= 0) pulseSeg(i);
    $$(".tlbar").forEach((el) => el.setAttribute("stroke", el.dataset.id === id ? css("--focus") : "none"));
  }

  /* ---------- document pane ---------- */
  function openDoc(id) {
    const d = caseData(S.sel); if (!d) return;
    const doc = d.docs.find((x) => x.id === id);
    if (!doc) return;
    $("#dId").textContent = doc.id; $("#dType").textContent = docClass(doc.type) + " · " + doc.type; $("#dTitle").textContent = doc.title || "";
    const body = $("#dBody");
    body.innerHTML = window.marked ? marked.parse(doc.md || "*(no source text)*") : "<pre>" + esc(doc.md) + "</pre>";
    highlightIn(body, doc.hl || { sup: [], con: [] });
    $("#doc").classList.add("open"); hideTip(); clearHover();
    pick(id, true);
    setTimeout(() => S.cy && S.cy.resize(), 220);
  }
  function closeDoc() {
    const was = $("#doc").classList.contains("open");
    $("#doc").classList.remove("open");
    if (was) setTimeout(() => { if (S.cy) { S.cy.resize(); S.cy.fit(S.cy.elements(), 40); } }, 220);
  }
  $("#dClose").onclick = closeDoc;
  function highlightIn(root, hl) {
    const terms = [].concat((hl.con || []).map((t) => [t, "con"]), (hl.sup || []).map((t) => [t, "sup"])).filter(([t]) => t && t.length >= 3);
    if (!terms.length) return;
    const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    terms.sort((a, b) => b[0].length - a[0].length);
    const kind = new Map(terms.map(([t, k]) => [t.toLowerCase(), k]));
    const re = new RegExp("(" + terms.map(([t]) => reEsc(t)).join("|") + ")", "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((tn) => {
      const s = tn.nodeValue; re.lastIndex = 0; if (!re.test(s)) return; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(s))) {
        frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const mk = document.createElement("mark"); mk.className = kind.get(m[0].toLowerCase()) || "sup"; mk.textContent = m[0]; frag.appendChild(mk);
        last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(s.slice(last))); tn.parentNode.replaceChild(frag, tn);
    });
  }

  /* ---------- timeline ---------- */
  function renderTimeline(d) {
    const wrap = $("#tl");
    if (!d || !d.timeline.length) { wrap.innerHTML = `<div class="note" style="padding:14px">No transactions in this bundle for the case.</div>`; $("#tlKey").textContent = ""; return; }
    const tl = d.timeline, W = Math.max(wrap.clientWidth - 20, tl.length * 9), H = 104, mid = 56;
    const t0 = Date.parse(tl[0].at), t1 = Date.parse(tl[tl.length - 1].at), span = Math.max(1, t1 - t0);
    const maxA = Math.max(...tl.map((x) => x.amt)), h = (a) => 6 + 40 * Math.sqrt(a / maxA);
    const x = (t) => 14 + ((Date.parse(t) - t0) / span) * (W - 28);
    const win = d.case.window || {};
    let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    if (win.from) { const a = x(win.from + "T00:00:00Z"), b = x((win.to || win.from) + "T23:59:59Z"); svg += `<rect x="${Math.max(0, a)}" y="4" width="${Math.max(2, b - a)}" height="${H - 18}" fill="${css("--surface")}" rx="3"/><text x="${Math.max(4, a + 4)}" y="14" fill="${css("--text-faint")}" font-size="9.5" font-family="Plex Mono">review window</text>`; }
    svg += `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="${css("--border")}"/>`;
    const months = new Set();
    tl.forEach((t) => {
      const m = t.at.slice(0, 7); if (!months.has(m)) { months.add(m); const xx = x(m + "-01T00:00:00Z"); if (xx > 0) svg += `<text x="${xx + 2}" y="${H - 3}" fill="${css("--text-faint")}" font-size="9.5" font-family="Plex Mono">${new Date(m + "-01").toLocaleString("en-GB", { month: "short", year: "numeric" })}</text><line x1="${xx}" x2="${xx}" y1="${H - 14}" y2="${H - 10}" stroke="${css("--border-strong")}"/>`; }
    });
    tl.forEach((t) => {
      const hh = h(t.amt), xx = x(t.at), up = t.dir === "in";
      const col = t.alerted ? css("--node-transaction") : "#3A4A60";
      const held = t.id === d.case.held;
      svg += `<rect class="tlbar" data-id="${t.id}" x="${xx - 2.5}" y="${up ? mid - hh : mid}" width="5" height="${hh}" rx="1" fill="${held ? css("--escalate") : col}" opacity="${t.alerted ? 1 : 0.7}" stroke="none" stroke-width="2"><title>${esc(t.at.slice(0, 10))}  ${esc(gbp(t.amt))} ${t.dir}  ${esc(t.cp)}${t.ref ? " · " + esc(t.ref) : ""}${t.alerted ? "  [alerted]" : ""}  ${t.id}</title></rect>`;
      if (t.alerted) svg += `<circle cx="${xx}" cy="${up ? mid - hh - 5 : mid + hh + 5}" r="2.2" fill="${css("--node-alert")}"/>`;
    });
    svg += `</svg>`;
    wrap.innerHTML = svg;
    $("#tlKey").innerHTML = `${tl.length} transactions · <span style="color:${css("--node-transaction")}">■</span> alerted (● marker) · <span style="color:#3A4A60">■</span> other · up = in, down = out${d.case.held ? ` · <span style="color:${css("--escalate")}">■</span> held payment` : ""}`;
    $$(".tlbar", wrap).forEach((el) => (el.onclick = () => { pick(el.dataset.id, true); pulseTx(el.dataset.id); }));
  }

  /* ---------- file picker: load a fresh trace (and optionally its output) ---------- */
  $("#picker").onchange = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    const traces = {}, outs = {};
    for (const f of files) {
      const txt = await f.text();
      txt.split("\n").filter((l) => l.trim()).forEach((l) => { try { const o = JSON.parse(l); if (o.nodes) traces[o.case_id] = o; else if (o.reason_code) outs[o.case_id] = o; } catch (_) {} });
    }
    const ids = Object.keys(traces).length ? Object.keys(traces) : Object.keys(outs);
    const rows = [], detail = {};
    ids.forEach((id) => {
      const t = traces[id], o = outs[id] || (t ? { case_id: id, alert_ids: t.nodes.filter((n) => n.type === "alert").map((n) => n.id), verdict: t.verdict, reason_code: t.reason_code, reason: "(official reason not loaded — pick the .jsonl output too)", evidence: [] } : null);
      if (!o) return;
      const cust = t ? t.nodes.find((n) => n.type === "customer") : null;
      rows.push({ id, name: cust ? cust.label : "", rules: t ? t.nodes.filter((n) => n.type === "alert").map((n) => n.label) : [], amount: t ? (t.reconciliation || []).reduce((a, r) => Math.max(a, r.alerted_gbp || 0), 0) : 0, verdict: o.verdict, code: o.reason_code, alerts: o.alert_ids.length, detail: !!t, reason: o.reason, evidence: o.evidence });
      if (t) {
        const recs = t.reconciliation || [];
        const ex = recs.reduce((a, r) => a + (r.explained_gbp || 0), 0), un = recs.reduce((a, r) => a + (r.unexplained_gbp || 0), 0), pr = recs.reduce((a, r) => a + (r.profile_gbp || 0), 0);
        const segs = [];
        const docs = [...new Set(recs.flatMap((r) => r.explained_by || []))];
        if (ex) segs.push({ kind: "doc", doc: docs.join(", ") || "evidence", amount: ex, txns: [] });
        if (pr) segs.push({ kind: "profile", doc: null, amount: pr, txns: [] });
        if (un) segs.push({ kind: "unexplained", doc: null, amount: un, txns: recs.flatMap((r) => r.unexplained_txns || []) });
        detail[id] = { out: o, case: { window: {}, held: null }, customer: { name: cust ? cust.label : "", customer_id: cust ? cust.id : "" }, alerts: t.nodes.filter((n) => n.type === "alert").map((n) => ({ id: n.id, rule: n.label, txns: [] })),
          trace: t, recon: { total: ex + un + pr, unexplained: un, segments: segs, rule_view: recs.map((r) => ({ alert: r.alert_id, rule: r.rule, alerted: r.alerted_gbp, explained: r.explained_gbp, unexplained: r.unexplained_gbp, cleared: r.cleared })) }, timeline: [], docs: [], reviews: [], list: [] };
      }
    });
    window.PROOF_DATA = window.PROOF_DATA || {};
    window.PROOF_DATA.upload = { inst: "upload", rows, detail, demos: {}, runs: [] };
    useInst("upload");
    e.target.value = "";
  };

  /* ---------- ontology panel ---------- */
  $("#ontoTree").innerHTML = ONTO.tree ? esc(ONTO.tree).replace(/^(\s*)([A-Z]\w+)/gm, "$1<b>$2</b>") : "proof.owl not bundled";

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) { if (e.key === "Escape") e.target.blur(); return; }
    const vis = S.visible; const i = vis.findIndex((r) => r.id === S.sel);
    if (e.key === "j" || e.key === "ArrowDown") { const r = vis[Math.min(vis.length - 1, i + 1)]; if (r) openCase(r.id); e.preventDefault(); }
    else if (e.key === "k" || e.key === "ArrowUp") { const r = vis[Math.max(0, i - 1)]; if (r) openCase(r.id); e.preventDefault(); }
    else if (e.key === "Enter" && S.sel) openCase(S.sel);
    else if (e.key === "f") $("#fitBtn").click();
    else if (e.key === "p") document.body.classList.toggle("present");
    else if (e.key === "Escape") { closeDoc(); clearHover(); pick("__none__"); $("#badge").classList.remove("open"); }
  });
  window.addEventListener("resize", () => { if (S.cy) S.cy.resize(); if (S.sel) renderTimeline(caseData(S.sel)); });

  /* ---------- boot ---------- */
  if (INSTS.length) loadInst(new URLSearchParams(location.search).get("inst") || INSTS[0]);
  else toastEmpty("No data bundle found. Run  python3 viewer/build_data.py");
  window.PROOF = { openCase, loadInst, startReplay, stopReplay, state: S };
})();
