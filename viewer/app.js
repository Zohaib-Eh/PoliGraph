/* PoliGraph viewer: static multi-page app (hash routing, vanilla JS, offline). Data: window.PROOF_DATA[inst] from build_data.py. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const gbp = (x) => "£" + Number(x || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gbp0 = (x) => "£" + Math.round(Number(x || 0)).toLocaleString("en-GB");
  const n0 = (x) => Math.round(Number(x || 0)).toLocaleString("en-GB");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const ONTO = window.PROOF_ONTOLOGY || { nodeClass: {}, docClass: {}, edgeProp: {}, tree: "" };
  const INSTS = window.PROOF_INSTS || [];
  const LABEL = { bank: "Bank", emoney: "E-money", investment: "Investment", payments_fx: "Payments / FX" };
  const PREFIX = { BK: "bank", EM: "emoney", IV: "investment", PX: "payments_fx" };
  const londonTime = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " London";

  const S = { inst: null, data: null, rows: [], q: { v: "ALL", rule: "", code: "", text: "", sort: "id", dir: 1, limit: 150 },
    replay: null, decided: null, view: "story", graphAll: false, cy: null, extra: {} };
  window.PROOF_DATA = window.PROOF_DATA || {};

  /* ---------- plain words ---------- */
  const CODE_WORDS = {
    COLLECTION_DOCUMENTED: "Group collection documented", BUSINESS_RECORDS_RECONCILE: "Business records reconcile",
    DOCUMENTED_EVENT: "Documented life event", INVOICE_MATCHES: "Invoice matches the payment", OWN_ACCOUNT: "Money from the customer's own account",
    GROUP_COMPANY: "Payment within the customer's group", THIRD_PARTY_DOCUMENTED: "Third-party payment documented",
    REFUND_OF_EARLIER_PAYMENT: "Refund of an earlier payment", RETURNING_CUSTOMER: "Returning customer, same pattern as before",
    LIST_MATCH_DIFFERENT_PARTY: "List match is a different person", WITHIN_PROFILE: "Within the customer's declared profile",
    RFI_PURPOSE_DOCUMENTS: "Ask for documents showing the purpose", RFI_BUSINESS_RECORDS: "Ask for business records",
    RFI_SOURCE_OF_FUNDS: "Ask where the money came from", RFI_COUNTERPARTY_DETAILS: "Ask who the counterparty is",
    RFI_UPDATED_PROFILE: "Ask for an updated customer profile",
    ESC_MULE_ACTIVITY: "Signs of money-mule activity", ESC_STRUCTURING: "Deposits split to avoid a threshold",
    ESC_UNEXPLAINED_FUNDS: "Funds with no credible explanation", ESC_PASS_THROUGH: "Money passed straight through",
    ESC_INVOICE_MISMATCH: "Invoice does not match the payment", ESC_HIGH_RISK_CORRIDOR: "Unexplained high-risk corridor",
    ESC_ACCOUNT_MISUSE: "Account used for someone else", ESC_THIRD_PARTY_FUNDING: "Unexplained third-party funding",
    ESC_EARLY_REDEMPTION: "Unexplained early redemption", ESC_LISTED_PARTY: "Listed party involved in the payment",
  };
  const TM_WORDS = { TM01: "Activity above declared profile", TM02: "Rapid movement of funds", TM03: "Repeated deposits below a threshold",
    TM04: "Many-to-one or one-to-many payments", TM05: "Large cash activity", TM06: "Higher-risk corridor", TM07: "Dormant account reactivated",
    TM08: "Third-party funding or payout", TM10: "Unusually early redemption", TM22: "Counterparty on an internal list" };
  const words = (code) => CODE_WORDS[code] || String(code || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const tmWords = (r) => TM_WORDS[r] || r;
  const RULE_TEXT = {
    X1_document_reconciles: ["Document reconciles", "A document states the transaction's exact amount and names the party or the customer."],
    X2_own_account_statement: ["Own account proven", "A statement names the customer as holder of the counterparty account."],
    X3_group_collection: ["Group collection", "Every payer is on the booking's traveller list and the payout equals the booking."],
    X4_group_company: ["Group company", "The group structure shows the counterparty and the customer share an owner."],
    X5_cash_redeposited: ["Cash re-deposited", "An earlier withdrawal of the same amount, reviewed before, is being paid back in."],
    X6_redemption_reason_documented: ["Redemption reason documented", "A redundancy letter plus the customer's sell request."],
    R_CLOSE: ["Close", "Every alert reconciles to evidence and no suspicion rule fired."],
    R_RFI: ["Request information", "An alert is still open: ask for the specific missing document."],
    R_OWN_ACCOUNT_PROFILE_UPDATE: ["Profile update needed", "Own-account money, but activity is far above the declared profile."],
    R_KEYWORD_SUSPICION: ["Suspicion keyword", "Unreconciled activity plus a fraud, mule or crypto indicator in the documents."],
    R_TM22: ["Watch-list resolution", "Decide whether the internal-list match is the same party, a different party, or unsettled."],
  };
  function ruleText(label) {
    label = String(label || "");
    if (RULE_TEXT[label]) return RULE_TEXT[label];
    let m = label.match(/^R_RECONCILE_(TM\d+)/); if (m) return ["Reconcile " + m[1], `Pounds alerted by ${m[1]} minus pounds explained by evidence, against the limit that made ${m[1]} fire.`];
    m = label.match(/^R_TM22_(.*)/); if (m) return ["Watch-list: " + m[1].replace(/_/g, " "), "Resolve the internal-list match: same party (escalate), different party (clear) or unsettled (ask)."];
    m = label.match(/^S\d+_(.*)/); if (m) return [m[1].replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), "Suspicion rule: when its facts hold, the case escalates whatever the other documents say."];
    return [label.replace(/_/g, " "), ""];
  }
  function ruleKind(label) {
    if (/^S\d+_|R_KEYWORD/.test(label)) return "Suspicion";
    if (/^R_TM22/.test(label)) return "Watch-list";
    if (/^X\d+_/.test(label)) return "Explanation";
    if (/^R_RECONCILE/.test(label)) return "Reconciliation";
    return "Decision";
  }
  const FACT_WORDS = {
    listed_person_controlled_counterparty_at_payment: "Listed person controlled the payee at payment",
    officer_resigned_before_payment: "Register shows resignation before payment",
    explains: "Document explains the payment",
    customer_asked_how_to_avoid_threshold: "Customer asked how to avoid the threshold",
  };
  const factWords = (f) => f.kind === "explains" ? `${(f.sources || []).filter((s) => !/-T\d/.test(s)).join(", ") || "Document"} explains it` :
    FACT_WORDS[f.kind] || String(f.kind || "fact").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  function monoize(text) {
    return esc(text).replace(/(£[\d,]+(?:\.\d{2})?|\b[A-Z]{2,4}-[A-Z]{0,3}\d{2,}\b|\b(?:TM\d{2}|RFI_[A-Z_]+|ESC_[A-Z_]+)\b)/g, '<span class="m">$1</span>');
  }
  const pill = (v, lg) => `<span class="pill ${v}${lg ? " lg" : ""}">${v === "ESCALATE" ? "Escalate" : v === "CLOSE" ? "Close" : v === "RFI" ? "RFI" : esc(v)}</span>`;
  const docClass = (t) => ONTO.docClass[t] || "Document";
  const instLabel = (i) => LABEL[i] || (S.extra[i] && S.extra[i].label) || i;

  /* ---------- institution loading (lazy <script> so file:// works) ---------- */
  function ensureInst(inst) {
    return new Promise((res, rej) => {
      if (window.PROOF_DATA[inst]) return res(window.PROOF_DATA[inst]);
      if (!INSTS.includes(inst)) return rej(new Error("unknown institution " + inst));
      const s = document.createElement("script");
      s.src = "data/" + inst + ".js";
      s.onload = () => res(window.PROOF_DATA[inst]);
      s.onerror = () => rej(new Error("Could not load data/" + inst + ".js. Run python3 viewer/build_data.py"));
      document.body.appendChild(s);
    });
  }
  async function setInst(inst) {
    if (S.inst === inst && S.data) return;
    stopReplay();
    const d = await ensureInst(inst);
    S.inst = inst; S.data = d; S.rows = d.rows; S.decided = null; S.cy = null;
    S.q.rule = ""; S.q.code = ""; S.q.limit = 150;
    renderSide();
  }
  function renderSide() {
    const sel = $("#instSel");
    const list = INSTS.concat(Object.keys(S.extra));
    sel.innerHTML = list.map((i) => `<option value="${esc(i)}"${i === S.inst ? " selected" : ""}>${esc(instLabel(i))}</option>`).join("");
    const runs = (S.data && S.data.runs) || [];
    const hs = new Set(runs.map((r) => r.verdict_code_hash));
    $("#repro").innerHTML = runs.length ? `<span class="dot" style="background:${hs.size === 1 ? css("--close") : css("--esc")}"></span>${hs.size === 1 ? runs.length : "!"}/${runs.length} identical runs` :
      `<span class="dot" style="background:${css("--faint")}"></span>${S.extra[S.inst] ? "session run" : "1 run"}`;
  }
  $("#instSel").onchange = async (e) => { await setInst(e.target.value); const r = parseHash(); if (r.page === "case") location.hash = "#/queue"; else route(); };

  /* ---------- router ---------- */
  function parseHash() {
    const p = (location.hash || "#/").replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    return { page: p[0] || "overview", args: p.slice(1) };
  }
  async function route() {
    const r = parseHash();
    if (S.replay && r.page !== "queue") stopReplay();
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (r.page === "case" ? "queue" : r.page)));
    const main = $("#main");
    try {
      if (!S.data) {
        if (!INSTS.length) { main.innerHTML = `<div class="page"><div class="empty"><h2>No data bundle</h2><p>Run <span class="mono">python3 viewer/build_data.py</span>.</p></div></div>`; return; }
        await setInst(new URLSearchParams(location.search).get("inst") || INSTS[0]);
      }
      if (r.page === "case") {
        const id = r.args[0];
        if (!S.rows.some((x) => x.id === id)) {
          const guess = PREFIX[(id || "").slice(0, 2)];
          const other = Object.keys(S.extra).find((k) => window.PROOF_DATA[k].rows.some((x) => x.id === id));
          if (guess && guess !== S.inst && !other) await setInst(guess);
        }
      }
      const fn = { overview: pageOverview, queue: pageQueue, case: pageCase, rules: pageRules, about: pageAbout, import: pageImport }[r.page] || pageOverview;
      hidePop();
      fn(main, r.args);
      if (r.page !== "case") main.scrollTop = 0;
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="page"><div class="empty"><h2>Something went wrong</h2><p>${esc(err.message)}</p></div></div>`;
    }
  }
  window.addEventListener("hashchange", route);
  const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

  /* ---------- shared bits ---------- */
  function counts(rows) {
    const c = { n: rows.length, CLOSE: 0, RFI: 0, ESCALATE: 0, closedAlerts: 0 };
    rows.forEach((r) => { c[r.verdict] = (c[r.verdict] || 0) + 1; if (r.verdict === "CLOSE") c.closedAlerts += r.alerts || 1; });
    return c;
  }
  const VCOL = { CLOSE: "--close", RFI: "--rfi", ESCALATE: "--esc" };
  function mixBar(c) {
    const t = c.n || 1;
    return `<div class="mix">${["CLOSE", "RFI", "ESCALATE"].map((v) => `<div style="flex:${c[v] || 0};background:${css(VCOL[v])}" title="${v} ${c[v]}"></div>`).join("")}</div>
      <div class="legend-row">${["CLOSE", "RFI", "ESCALATE"].map((v) => `<span><span class="sw" style="background:${css(VCOL[v])}"></span>${v === "ESCALATE" ? "Escalate" : v === "CLOSE" ? "Close" : "RFI"}<b>${n0(c[v])}</b> <span class="note">${Math.round((100 * (c[v] || 0)) / t)}%</span></span>`).join("")}</div>`;
  }
  const page = (inner) => `<div class="page">${inner}</div>`;
  const ph = (title, sub, right) => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${right || ""}</div>`;
  function hidePop() { $("#pop").classList.remove("show"); }
  function showPop(anchor, html) {
    const p = $("#pop"); p.innerHTML = html; p.classList.add("show");
    const r = anchor.getBoundingClientRect();
    p.style.top = r.bottom + 8 + "px"; p.style.left = Math.max(12, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 12)) + "px";
  }
  document.addEventListener("click", (e) => { if (!e.target.closest("#pop") && !e.target.closest("[data-pop]")) hidePop(); });

  /* ---------- Overview ---------- */
  function pageOverview(main) {
    const c = counts(S.rows), runs = S.data.runs || [];
    const ok = runs.length > 1 && new Set(runs.map((r) => r.verdict_code_hash)).size === 1;
    const hours = (c.closedAlerts * 20) / 60;
    const k = (label, v, sub, cls) => `<div class="kpi ${cls || ""}"><div class="k">${label}</div><div class="v">${v}</div><div class="s">${sub || "&nbsp;"}</div></div>`;
    const byId = Object.fromEntries(S.rows.map((r) => [r.id, r]));
    const demos = S.data.demos || {};
    const dlab = { close: "Clean close: every pound explained", esc: "Escalation: documents disagree", rfi: "RFI: part of the money unexplained" };
    const codes = {}; S.rows.forEach((r) => (codes[r.code] = (codes[r.code] || 0) + 1));
    const top = Object.entries(codes).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 7);
    const max = top.length ? top[0][1] : 1;
    const VERD = (code) => (/^ESC_/.test(code) ? "ESCALATE" : /^RFI_/.test(code) ? "RFI" : "CLOSE");
    main.innerHTML = page(ph("Overview", `${esc(instLabel(S.inst))} · ${n0(c.n)} alert cases triaged by the rule engine`) + `
      <div class="kpis">
        ${k("Cases decided", n0(c.n), "every case gets a verdict")}
        ${k("Close", n0(c.CLOSE), `${Math.round((100 * c.CLOSE) / (c.n || 1))}% of cases`)}
        ${k("Request info", n0(c.RFI), `${Math.round((100 * c.RFI) / (c.n || 1))}% of cases`)}
        ${k("Escalate", n0(c.ESCALATE), `${Math.round((100 * c.ESCALATE) / (c.n || 1))}% of cases`)}
        ${k("Analyst hours saved", n0(hours) + '<span class="u">h</span>', "20 min per alert closed")}
        ${k("Reproducibility", runs.length ? (ok ? `${runs.length}/${runs.length} identical` : "mismatch") : "1 run", runs.length ? `hash ${runs[0].verdict_code_hash.slice(0, 10)}` : "session run", "repro-k")}
      </div>
      <div class="grid g-main">
        <div class="stack">
          <div class="card"><h2>Verdict mix</h2><p class="hint">Share of cases per verdict.</p>${mixBar(c)}</div>
          <div class="card"><h2>Top reasons</h2><p class="hint">The reason codes the engine gave most often.</p>
            <div class="list">${top.map(([code, n]) => `<a class="li" href="#/queue" data-code="${code}"><div><div class="t">${esc(words(code))}</div><div class="bar"><div style="width:${(100 * n) / max}%;background:${css(VCOL[VERD(code)])}"></div></div></div><div class="num">${n0(n)}</div></a>`).join("")}</div></div>
        </div>
        <div class="card"><h2>Demo cases</h2><p class="hint">Three cases that show how the engine thinks.</p>
          <div class="list">${["close", "esc", "rfi"].filter((x) => demos[x] && byId[demos[x]]).map((x) => { const r = byId[demos[x]]; return `<a class="li" href="#/case/${r.id}"><div><div class="t">${esc(dlab[x])}</div><div class="d"><span class="mono">${r.id}</span> · ${esc(r.name)} · ${gbp0(r.amount)}</div><div class="d">${esc(words(r.code))}</div></div><div>${pill(r.verdict)}</div></a>`; }).join("") || '<p class="note">No pinned cases in this data set.</p>'}</div>
        </div>
      </div>`);
    $$("a[data-code]", main).forEach((a) => (a.onclick = () => { S.q.code = a.dataset.code; S.q.v = "ALL"; }));
  }

  /* ---------- Queue ---------- */
  function match(r) {
    const f = S.q;
    if (f.v !== "ALL" && r.verdict !== f.v) return false;
    if (f.rule && !r.rules.includes(f.rule)) return false;
    if (f.code && r.code !== f.code) return false;
    if (f.text) { const q = f.text.toLowerCase(); if (!r.id.toLowerCase().includes(q) && !(r.name || "").toLowerCase().includes(q)) return false; }
    return true;
  }
  function sorted(rows) {
    const k = S.q.sort, d = S.q.dir;
    const key = { id: (r) => r.id, name: (r) => (r.name || "").toLowerCase(), rule: (r) => r.rules.join(","), amount: (r) => r.amount, verdict: (r) => ({ ESCALATE: 0, RFI: 1, CLOSE: 2 }[r.verdict]), code: (r) => words(r.code) }[k];
    return rows.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1) * d; });
  }
  function rowHTML(r, arrive) {
    return `<tr class="row${arrive ? " arrive" : ""}" data-id="${r.id}"><td class="cid">${r.id}</td><td>${esc(r.name)}</td>
      <td><span class="mono">${r.rules.slice(0, 2).join(" + ")}${r.rules.length > 2 ? " +" + (r.rules.length - 2) : ""}</span><div class="muted">${esc(tmWords(r.rules[0]))}</div></td>
      <td class="r num">${gbp0(r.amount)}</td><td>${S.replay && !r._done ? '<span class="pill pending">Deciding</span>' : pill(r.verdict)}</td><td class="sub2">${esc(words(r.code))}${r.detail ? "" : ' <span class="chip" title="Rebuild with --detail 1000 for its graph">summary</span>'}</td></tr>`;
  }
  function pageQueue(main) {
    const rules = [...new Set(S.rows.flatMap((r) => r.rules))].sort();
    const codes = [...new Set(S.rows.map((r) => r.code))].sort((a, b) => (words(a) < words(b) ? -1 : 1));
    const th = (k, label, cls) => `<th data-k="${k}" class="${cls || ""}">${label}${S.q.sort === k ? `<span class="arr">${S.q.dir > 0 ? "↑" : "↓"}</span>` : ""}</th>`;
    main.innerHTML = page(ph("Queue", `${esc(instLabel(S.inst))} · every alert case and its verdict`, `<button class="btn ${S.replay ? "live" : ""}" id="replayBtn">${S.replay ? "Stop replay" : "▶ Replay the queue"}</button>`) + `
      <div class="toolbar">
        <input type="search" id="qText" placeholder="Search case or customer" value="${esc(S.q.text)}">
        <div class="seg" id="qV">${["ALL", "CLOSE", "RFI", "ESCALATE"].map((v) => `<button data-v="${v}" class="${S.q.v === v ? "on" : ""}">${{ ALL: "All", CLOSE: "Close", RFI: "RFI", ESCALATE: "Escalate" }[v]}</button>`).join("")}</div>
        <select id="qRule"><option value="">All rules</option>${rules.map((r) => `<option value="${r}"${S.q.rule === r ? " selected" : ""}>${r} · ${esc(tmWords(r))}</option>`).join("")}</select>
        <select id="qCode"><option value="">All reasons</option>${codes.map((c) => `<option value="${c}"${S.q.code === c ? " selected" : ""}>${esc(words(c))}</option>`).join("")}</select>
      </div>
      <div class="live-strip" id="live"></div>
      <div class="card tblwrap"><table class="tbl"><thead><tr>${th("id", "Case")}${th("name", "Customer")}${th("rule", "Rule")}${th("amount", "Amount alerted", "r")}${th("verdict", "Verdict")}${th("code", "Reason")}</tr></thead><tbody id="qBody"></tbody></table><div class="more" id="qMore"></div></div>`);
    $("#qText").oninput = (e) => { S.q.text = e.target.value.trim(); S.q.limit = 150; drawTable(); };
    $$("#qV button").forEach((b) => (b.onclick = () => { S.q.v = b.dataset.v; $$("#qV button").forEach((x) => x.classList.toggle("on", x === b)); S.q.limit = 150; drawTable(); }));
    $("#qRule").onchange = (e) => { S.q.rule = e.target.value; drawTable(); };
    $("#qCode").onchange = (e) => { S.q.code = e.target.value; drawTable(); };
    $$("th[data-k]", main).forEach((t) => (t.onclick = () => { if (S.replay) return; S.q.dir = S.q.sort === t.dataset.k ? -S.q.dir : 1; S.q.sort = t.dataset.k; pageQueue(main); }));
    $("#qBody").onclick = (e) => { const tr = e.target.closest("tr.row"); if (tr) go("#/case/" + tr.dataset.id); };
    $("#replayBtn").onclick = () => (S.replay ? stopReplay() : startReplay());
    drawTable();
  }
  function drawTable() {
    const body = $("#qBody"); if (!body) return;
    if (S.replay) { liveStrip(); return; }
    const vis = sorted(S.rows.filter(match));
    S.visible = vis;
    body.innerHTML = vis.slice(0, S.q.limit).map((r) => rowHTML(r)).join("") || `<tr><td colspan="6" class="empty">No cases match these filters.</td></tr>`;
    $("#qMore").innerHTML = vis.length > S.q.limit ? `<button class="btn" id="moreBtn">Show more · ${n0(vis.length - S.q.limit)} left</button>` : `<span class="note">${n0(vis.length)} case${vis.length === 1 ? "" : "s"}</span>`;
    const mb = $("#moreBtn"); if (mb) mb.onclick = () => { S.q.limit += 300; drawTable(); };
    liveStrip();
  }
  function liveStrip() {
    const el = $("#live"); if (!el) return;
    if (!S.replay) { el.innerHTML = ""; return; }
    const c = counts(S.decided);
    el.innerHTML = `<span><b>${n0(c.n)}</b>of ${n0(S.rows.length)} decided</span><span><b style="color:${css("--close")}">${n0(c.CLOSE)}</b>close</span><span><b style="color:${css("--rfi")}">${n0(c.RFI)}</b>RFI</span><span><b style="color:${css("--esc")}">${n0(c.ESCALATE)}</b>escalate</span><span><b>${n0((c.closedAlerts * 20) / 60)}</b>analyst hours saved</span>`;
  }
  function tick() {
    const R = S.replay; if (!R) return;
    const body = $("#qBody"); if (!body) return stopReplay();
    // finish deciding the previous arrival, then a new one arrives
    if (R.pending) { R.pending._done = true; S.decided.push(R.pending); const tr = body.querySelector(`tr[data-id="${R.pending.id}"]`); if (tr) tr.outerHTML = rowHTML(R.pending); R.pending = null; liveStrip(); }
    if (R.i >= S.rows.length) return stopReplay(true);
    for (let k = 0; k < R.batch; k++) {
      if (R.i >= S.rows.length) break;
      const r = Object.assign({}, S.rows[R.i++], { _done: false });
      if (k < R.batch - 1) { r._done = true; S.decided.push(r); }
      else R.pending = r;
      if (!match(r)) continue;
      body.insertAdjacentHTML("afterbegin", rowHTML(r, true));
    }
    const rows = body.children; while (rows.length > 60) rows[rows.length - 1].remove();
    liveStrip();
  }
  function startReplay() {
    S.decided = [];
    S.replay = { i: 0, batch: 1, pending: null, timer: null };
    $("#replayBtn").classList.add("live"); $("#replayBtn").textContent = "Stop replay";
    $("#qBody").innerHTML = ""; $("#qMore").innerHTML = '<span class="note">Replaying the queue in file order, one decision at a time, then faster.</span>';
    let n = 0;
    const loop = () => { if (!S.replay) return; tick(); n++; S.replay.batch = n < 25 ? 1 : n < 60 ? 4 : 12; S.replay.timer = setTimeout(loop, n < 25 ? 260 : 120); };
    loop();
  }
  function stopReplay(done) {
    if (!S.replay) return;
    clearTimeout(S.replay.timer); S.replay = null;
    const b = $("#replayBtn"); if (b) { b.classList.remove("live"); b.textContent = "▶ Replay the queue"; }
    if ($("#qBody")) drawTable();
  }

  /* ---------- Case page ---------- */
  const rowOf = (id) => S.rows.find((r) => r.id === id);
  const caseData = (id) => (S.data.detail || {})[id] || null;
  function deciding(d) {
    const s = new Set(); if (!d) return s;
    d.trace.firings.forEach((f) => { if (f.advisory) return; (f.facts || []).forEach((fid) => { const fact = d.trace.facts.find((x) => x.id === fid); if (fact) fact.sources.forEach((x) => s.add(x)); }); (f.docs || []).forEach((x) => s.add(x)); });
    return s;
  }
  function evInfo(id, d, r) {
    const out = { type: "", role: "" };
    if (!d) { if ((r.alert_ids || []).includes(id)) out.type = "Alert"; return out; }
    const doc = d.docs.find((x) => x.id === id);
    const a = d.alerts.find((x) => x.id === id);
    const t = d.timeline.find((x) => x.id === id);
    const le = d.list.find((x) => x.entry_id === id);
    const rv = (d.reviews || []).find((x) => x.review_id === id);
    if (doc) { out.type = docClass(doc.type); out.role = doc.title || doc.type.replace(/_/g, " "); }
    else if (a) { out.type = "Alert"; out.role = `${a.rule} · ${tmWords(a.rule)}`; }
    else if (t) { out.type = id === d.case.held ? "Held payment" : "Transaction"; out.role = `${gbp(t.amt)} ${t.dir === "in" ? "from" : "to"} ${t.cp} · ${t.at.slice(0, 10)}`; }
    else if (le) { out.type = "List entry"; out.role = `${le.name || ""}${le.reason ? " · " + le.reason : ""}`; }
    else if (rv) { out.type = "Prior review"; out.role = rv.outcome || rv.summary || ""; }
    const rel = [];
    d.trace.edges.forEach((e) => {
      if (e.from === id && e.rel === "explains") rel.push("explains " + e.to);
      if (e.from === id && e.rel === "contradicts") rel.push("contradicts " + e.to);
      if (e.to === id && e.rel === "contradicts") rel.push("contradicted by " + e.from);
    });
    if (rel.length) out.role = [...new Set(rel)].slice(0, 2).join(" · ") + (out.role ? " · " + out.role : "");
    return out;
  }
  function pageCase(main, args) {
    const id = args[0], tab = args[1] || "decision";
    const r = rowOf(id);
    if (!r) { main.innerHTML = page(`<a class="crumb" href="#/queue">← Queue</a><div class="empty"><h2>Case not found</h2><p>${esc(id)} is not in ${esc(instLabel(S.inst))}.</p></div>`); return; }
    const d = caseData(id);
    const tabs = [["decision", "Decision"], ["why", "Why"], ["documents", "Documents"], ["timeline", "Timeline"]];
    main.innerHTML = page(`<a class="crumb" href="#/queue">← Queue</a>
      <div class="case-h"><div>${pill(r.verdict, true)}<h1>${esc(words(r.code))}</h1>
        <div class="meta"><span class="mono">${r.id}</span><span>${esc(r.name)}</span><span>${r.rules.map((x) => `<span class="mono">${x}</span> ${esc(tmWords(x))}`).join(" · ")}</span><span class="code">${r.code}</span></div></div>
        <div class="amt"><div class="v">${gbp(r.amount)}</div><div class="k">alerted · ${r.alerts} alert${r.alerts === 1 ? "" : "s"}</div></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/case/${r.id}/${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("")}</nav>
      <div id="tab"></div>`);
    const el = $("#tab");
    if (!d && tab !== "decision") { el.innerHTML = `<div class="card empty"><h2>Summary only</h2><p>This case's proof is not in the bundle. Rebuild with <span class="mono">python3 viewer/build_data.py --detail 1000</span>.</p></div>`; return; }
    ({ decision: tabDecision, why: tabWhy, documents: tabDocs, timeline: tabTimeline }[tab] || tabDecision)(el, r, d, args.slice(2));
  }
  function tabDecision(el, r, d) {
    const o = d ? d.out : { verdict: r.verdict, reason_code: r.code, reason: r.reason, evidence: r.evidence };
    const dec = deciding(d);
    const evs = o.evidence.slice().sort((a, b) => (dec.has(b) ? 1 : 0) - (dec.has(a) ? 1 : 0) || (a < b ? -1 : 1));
    let rec = "";
    if (d) {
      const rc = d.recon, tot = rc.total || 0;
      const explained = rc.segments.filter((s) => s.kind !== "unexplained").reduce((a, s) => a + s.amount, 0);
      const banner = o.verdict === "ESCALATE" ? `<div class="banner">${rc.unexplained === 0 && tot > 0 ? "The money reconciles, but a suspicion finding overrides it." : "Suspicion finding decides this case before reconciliation."}</div>` : "";
      rec = `<div class="card"><h2>Reconciliation</h2><p class="hint">Every alerted pound is either explained by a document, within the declared profile, or left open.</p>${banner}
        <div class="recbar">${rc.segments.map((s) => `<div class="${s.kind}" style="flex:${Math.max(s.amount, tot * 0.015)}" title="${esc(s.kind === "doc" ? gbp(s.amount) + " explained by " + s.doc : s.kind === "profile" ? gbp(s.amount) + " within profile" : gbp(s.amount) + " unexplained")}"></div>`).join("") || '<div class="profile" style="flex:1"></div>'}</div>
        <div class="reccap"><span>Explained <b>${gbp(explained)}</b> of <b>${gbp(tot)}</b></span><span style="color:${rc.unexplained > 0 ? css("--rfi") : css("--close")}">${gbp(rc.unexplained)} open</span></div>
        <div class="recrows">${rc.segments.map((s) => `<div><span><span class="sw" style="background:${s.kind === "doc" ? css("--close") : s.kind === "profile" ? "#3B4A61" : css("--rfi")}"></span>${s.kind === "doc" ? "Explained by " + monoize(s.doc) : s.kind === "profile" ? "Within declared profile or limit" : "Not explained"}</span><span class="num">${gbp(s.amount)}</span></div>`).join("")}</div></div>`;
    }
    const brief = d && d.brief;
    el.innerHTML = `<div class="grid g-main"><div class="stack">
        <div class="card"><h2>Official reason</h2><p class="hint">This exact text is the scored output. It is written from a template and holds only facts the engine proved.</p><p class="reason">${monoize(o.reason)}</p></div>
        ${brief ? `<div class="card brief"><h2>Plain-English brief</h2><p class="hint">Generated from the proof (${esc(brief.source)}), fact-checked, not used for scoring.</p><p>${monoize(brief.text.replace(/^PROOF /, "PoliGraph "))}</p></div>` : ""}
      </div><div class="stack">${rec}
        <div class="card ev"><h2>Cited evidence</h2><p class="hint">${evs.length} IDs in the output. <span style="color:var(--accent)">◆</span> marks the ones the deciding rule used.</p>
          <div class="list">${evs.map((id) => { const i = evInfo(id, d, r); const isDoc = d && d.docs.some((x) => x.id === id); return `<${isDoc ? `a href="#/case/${r.id}/documents/${id}"` : "div"} class="li"><span style="color:var(--accent);opacity:${dec.has(id) ? 1 : 0}">◆</span><div><div class="mono">${id} <span class="chip">${esc(i.type)}</span></div><div class="d">${esc(i.role)}</div></div><span class="go">${isDoc ? "open →" : ""}</span></${isDoc ? "a" : "div"}>`; }).join("")}</div></div>
      </div></div>`;
  }

  /* ---------- Why: story ---------- */
  function tabWhy(el, r, d) {
    el.innerHTML = `<div class="toolbar"><div class="seg" id="wView"><button data-v="story" class="${S.view === "story" ? "on" : ""}">Story</button><button data-v="graph" class="${S.view === "graph" ? "on" : ""}">Rule graph</button></div>
      <span class="note">${S.view === "story" ? "What the engine checked, in plain English. Read left to right." : "The ontology knowledge graph: every node is typed by proof.owl."}</span></div><div id="wBody"></div>`;
    $$("#wView button").forEach((b) => (b.onclick = () => { S.view = b.dataset.v; tabWhy(el, r, d); }));
    if (S.view === "story") story($("#wBody"), r, d); else graph($("#wBody"), r, d);
  }
  function story(el, r, d) {
    const st = d.story || { money: [], checks: [], more: 0 };
    const icon = { pass: "✓", fail: "✕", info: "?" };
    el.innerHTML = `<div class="story">
      <div class="col"><h3>Money in question</h3>${st.money.map((m) => `<div class="money"><div class="v">${gbp(m.amount)}</div><div class="d">${esc(m.words)}</div><div class="code">${m.rule} · ${m.alert}</div></div>`).join("")}</div>
      <div class="arrow">→</div>
      <div class="col"><h3>What we checked</h3>${st.checks.map((c) => `<div class="check ${c.status}"><div class="ic">${icon[c.status] || "•"}</div><div><div class="t">${monoize(c.title)}</div><div class="d">${monoize(c.detail)}</div>${(c.docs || []).map((x) => `<a class="lk" href="#/case/${r.id}/documents/${x}">${x} →</a>`).join(" &nbsp; ")}</div></div>`).join("")}${st.more ? `<p class="note">+${st.more} more checks in the rule graph.</p>` : ""}</div>
      <div class="arrow">→</div>
      <div class="col"><h3>Outcome</h3><div class="outcome">${pill(r.verdict, true)}<div class="w">${esc(words(r.code))}</div><div class="code">${r.code}</div>
        <p class="note" style="margin-top:14px">${r.verdict === "CLOSE" ? "Every alerted pound is accounted for and no red flag fired." : r.verdict === "RFI" ? "No red flag, but something is still open: the customer is asked for the missing piece." : "A red-flag rule fired. Escalation wins over any reconciliation."}</p></div></div>
    </div>`;
  }

  /* ---------- Why: rule graph (ontology knowledge graph) ---------- */
  const GC = { alert: "#7EB6FF", customer: "#9AA4B4", evidence: "#8E9BB0", fact: "#C3CCDA", rule: "#B59CFF" };
  const COLS = { customer: 0, alert: 0, evidence: 1, fact: 2, rule: 3, verdict: 4 };
  function graphElements(r, d, all) {
    const tr = d.trace, verdict = d.out.verdict, cited = new Set(d.out.evidence);
    const byId = Object.fromEntries(tr.nodes.map((n) => [n.id, n]));
    const nodes = new Map(), edges = new Map();
    const firings = tr.firings.map((f, i) => Object.assign({ nid: "R" + (i + 1) }, f)).filter((f) => all || !f.advisory);
    const decIdx = (() => { let k = -1; tr.firings.forEach((f, i) => { if (!f.advisory) k = i; }); return k; })();
    const contra = new Set(); tr.edges.forEach((e) => { if (e.rel === "contradicts") { contra.add(e.from); contra.add(e.to); } });
    const failOutcome = (f) => /^ESC_|^confirmed$|^S\d/.test(f.outcome || "") || /^S\d+_|KEYWORD/.test(f.rule);
    const openOutcome = (f) => /^RFI_|^open$|^unsettled|unresolved/.test(f.outcome || "");
    function evNode(id) {
      if (nodes.has(id)) return;
      const n = byId[id] || { id, type: /-T\d/.test(id) ? "transaction" : "document", label: id };
      let label = id, cls = n.class || ONTO.nodeClass[n.type] || "Document", type = "evidence", sub = "";
      if (n.type === "customer") { type = "customer"; label = n.label; cls = "Customer"; }
      else if (n.type === "alert") { type = "alert"; label = `${n.label} · ${tmWords(n.label)}\n${n.id}`; cls = "Alert"; }
      else if (n.type === "transaction" || /-T\d/.test(id)) { const t = d.timeline.find((x) => x.id === id); label = t ? `${gbp0(t.amt)} ${t.dir === "in" ? "from" : "to"} ${t.cp}` : id; sub = "transaction"; cls = "Transaction"; label += "\n" + id; }
      else if (n.type === "list_entry") { label = `${n.label}\n${id}`; sub = "list"; cls = "ListEntry"; }
      else { const doc = d.docs.find((x) => x.id === id); cls = doc ? docClass(doc.type) : cls; label = `${id}\n${doc ? doc.type.replace(/_/g, " ") : cls}`; sub = doc && doc.boiler ? "boiler" : "doc"; }
      nodes.set(id, { data: { id, label, type, cls, col: COLS[type], tip: n.label || "" }, classes: `${type} ${sub}${cited.has(id) ? " cited" : ""}${contra.has(id) ? " contra" : ""}` });
    }
    const addE = (s, t, rel, extra) => { const k = s + "|" + t + "|" + rel; if (!edges.has(k) && s !== t) edges.set(k, { data: { id: "e" + edges.size, source: s, target: t, rel, label: ONTO.edgeProp[rel] || rel }, classes: rel + (extra ? " " + extra : "") }); };
    // alerts and verdict always
    d.alerts.forEach((a) => evNode(a.id));
    nodes.set("VERDICT", { data: { id: "VERDICT", label: `${verdict === "ESCALATE" ? "Escalate" : verdict === "CLOSE" ? "Close" : "RFI"}\n${words(d.out.reason_code)}`, type: "verdict", cls: "Verdict", col: COLS.verdict }, classes: "verdict " + verdict });
    const usedFacts = new Set();
    firings.forEach((f) => {
      const [nm] = ruleText(f.rule);
      const adv = !!f.advisory, isDec = tr.firings.indexOf(tr.firings.find((x, i) => "R" + (i + 1) === f.nid)) === decIdx;
      nodes.set(f.nid, { data: { id: f.nid, label: nm + (adv ? "\n(advisory)" : ""), type: "rule", cls: (byId[f.nid] && byId[f.nid].class) || "Rule", col: COLS.rule, rule: f.rule, outcome: f.outcome, kind: ruleKind(f.rule) }, classes: "rule" + (adv ? " advisory" : "") + (isDec ? " deciding" : "") });
      addE(f.nid, "VERDICT", isDec ? "decidedBy" : "supports", adv ? "advisory" : "");
      const facts = (f.facts || []).map((fid) => tr.facts.find((x) => x.id === fid)).filter(Boolean);
      facts.forEach((fact) => {
        usedFacts.add(fact.id);
        const status = failOutcome(f) ? "fail" : openOutcome(f) ? "info" : "pass";
        const detail = Object.entries(fact).filter(([k]) => !["id", "kind", "sources", "rule", "code"].includes(k)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
        if (!nodes.has(fact.id)) nodes.set(fact.id, { data: { id: fact.id, label: factWords(fact), type: "fact", cls: "Fact", col: COLS.fact, tip: detail, kind: fact.kind }, classes: "fact " + status });
        addE(fact.id, f.nid, "usesFact", adv ? "advisory" : "");
        fact.sources.forEach((s) => { if (d.alerts.some((a) => a.id === s)) addE(s, fact.id, "supports"); else { evNode(s); addE(s, fact.id, contra.has(s) && status === "fail" ? "contradicts" : "supports"); } });
      });
      const alertsFor = f.alert ? [f.alert] : facts.length ? [] : d.alerts.map((a) => a.id);
      alertsFor.forEach((a) => { if (nodes.has(a)) addE(a, facts[0] ? facts[0].id : f.nid, "triggeredBy"); });
      if (!facts.length) (f.docs || []).forEach((x) => { evNode(x); addE(x, f.nid, "supports"); });
    });
    // connect each alert to the facts built on its transactions
    d.alerts.forEach((a) => { const tx = new Set(a.txns); tr.facts.forEach((fact) => { if (usedFacts.has(fact.id) && fact.sources.some((s) => tx.has(s) || s === a.id)) addE(a.id, fact.id, "triggeredBy"); }); });
    tr.edges.forEach((e) => { if (e.rel === "matches" && nodes.has(e.from)) { evNode(e.to); addE(e.from, e.to, "matches"); } });
    if (all) {
      evNode(tr.nodes[0].id);
      tr.nodes.forEach((n) => { if (["document", "list_entry", "record"].includes(n.type)) evNode(n.id); });
      tr.edges.forEach((e) => { if (nodes.has(e.from) && nodes.has(e.to) && ["explains", "contradicts", "matches"].includes(e.rel)) addE(e.from, e.to, e.rel); });
      nodes.forEach((n) => { if (n.data.type === "evidence" && ![...edges.values()].some((e) => e.data.source === n.data.id || e.data.target === n.data.id)) addE(tr.nodes[0].id, n.data.id, "hasEvidence", "holds"); });
    } else {
      tr.edges.forEach((e) => { if (e.rel === "contradicts" && (nodes.has(e.from) || nodes.has(e.to))) { evNode(e.from); evNode(e.to); addE(e.from, e.to, "contradicts"); } });
    }
    // alerts with nothing attached still point at the verdict
    d.alerts.forEach((a) => { if (![...edges.values()].some((e) => e.data.source === a.id)) addE(a.id, "VERDICT", "triggeredBy"); });
    nodes.forEach((n) => Object.assign(n.data, measure(n)));
    return [...nodes.values()].concat([...edges.values()]);
  }
  const _ctx = document.createElement("canvas").getContext("2d");
  function measure(n) {
    const t = n.data.type, mono = t === "alert" || t === "evidence";
    const fs = t === "verdict" ? 14 : mono ? 12.5 : 13, maxw = t === "fact" ? 200 : t === "verdict" ? 170 : 190, pad = t === "rule" || t === "verdict" ? 16 : 12;
    _ctx.font = `${t === "verdict" ? 600 : 400} ${fs}px ${mono ? "Plex Mono, monospace" : "Plex Sans, sans-serif"}`;
    let lines = 0, w = 0;
    String(n.data.label).split("\n").forEach((ln) => {
      const lw = _ctx.measureText(ln).width;
      if (lw <= maxw) { lines++; w = Math.max(w, lw); return; }
      let cur = ""; ln.split(" ").forEach((word) => { const nx = cur ? cur + " " + word : word; if (_ctx.measureText(nx).width > maxw && cur) { lines++; w = Math.max(w, _ctx.measureText(cur).width); cur = word; } else cur = nx; });
      if (cur) { lines++; w = Math.max(w, _ctx.measureText(cur).width); }
    });
    return { w: Math.ceil(Math.min(maxw, w) + 2 * pad + (t === "rule" ? 20 : 0)), h: Math.ceil(lines * fs * 1.3 + 2 * pad) };
  }
  function cyStyle() {
    const c = (v) => css(v);
    const box = (sel, col, extra) => ({ selector: sel, style: Object.assign({ shape: "round-rectangle", "background-color": col, "background-opacity": 0.1, "border-color": col, "border-width": 1.4, width: "data(w)", height: "data(h)", "text-valign": "center", "text-halign": "center", "text-margin-y": 0 }, extra || {}) });
    return [
      { selector: "node", style: { label: "data(label)", color: c("--text"), "font-family": "Plex Sans", "font-size": 13, "text-wrap": "wrap", "text-max-width": 190, "line-height": 1.3, "min-zoomed-font-size": 7, "transition-property": "opacity", "transition-duration": "150ms" } },
      box("node.alert", GC.alert, { "font-family": "Plex Mono", "font-size": 12.5 }),
      box("node.customer", GC.customer, { shape: "ellipse" }),
      box("node.evidence", GC.evidence, { "font-family": "Plex Mono", "font-size": 12, "background-opacity": 0.05, "border-width": 1 }),
      { selector: "node.evidence.cited", style: { "border-width": 1.8 } },
      { selector: "node.boiler", style: { opacity: 0.45 } },
      box("node.fact", GC.fact, { "background-opacity": 0.06, "text-max-width": 200 }),
      { selector: "node.fact.fail", style: { "border-color": c("--esc"), "background-color": c("--esc"), "background-opacity": 0.1, color: "#FFD3DB" } },
      { selector: "node.fact.info", style: { "border-color": c("--rfi"), "background-color": c("--rfi") } },
      { selector: "node.fact.pass", style: { "border-color": c("--close"), "background-color": c("--close"), "background-opacity": 0.07 } },
      box("node.rule", GC.rule, { shape: "round-hexagon", "font-weight": 500 }),
      { selector: "node.rule.advisory", style: { "border-style": "dashed", "background-opacity": 0.03, opacity: 0.75 } },
      { selector: "node.rule.deciding", style: { "border-width": 2.4 } },
      box("node.verdict", "#888", { "font-size": 14, "font-weight": 600, "border-width": 2.4, "text-max-width": 170 }),
      { selector: "node.verdict.CLOSE", style: { "background-color": c("--close"), "border-color": c("--close"), color: c("--close"), "background-opacity": 0.12 } },
      { selector: "node.verdict.RFI", style: { "background-color": c("--rfi"), "border-color": c("--rfi"), color: c("--rfi"), "background-opacity": 0.12 } },
      { selector: "node.verdict.ESCALATE", style: { "background-color": c("--esc"), "border-color": c("--esc"), color: c("--esc"), "background-opacity": 0.12 } },
      { selector: "edge", style: { width: 1.5, "curve-style": "bezier", "line-color": "#3A475D", "target-arrow-color": "#3A475D", "target-arrow-shape": "triangle", "arrow-scale": 0.9, opacity: 0.9, label: "", "font-size": 11, "font-family": "Plex Mono", color: c("--sub"), "text-background-color": c("--bg"), "text-background-opacity": 1, "text-background-padding": 3, "text-rotation": "autorotate" } },
      { selector: "edge.decidedBy", style: { "line-color": GC.rule, "target-arrow-color": GC.rule, width: 2.4, label: "data(label)" } },
      { selector: "edge.usesFact", style: { "line-color": "#56627A", "target-arrow-color": "#56627A", width: 1.8 } },
      { selector: "edge.matches", style: { "line-style": "dotted", label: "data(label)" } },
      { selector: "edge.explains", style: { "line-color": c("--close"), "target-arrow-color": c("--close"), opacity: 0.7, label: "data(label)" } },
      { selector: "edge.contradicts", style: { "line-color": c("--esc"), "target-arrow-color": c("--esc"), width: 2.6, "line-style": "dashed", "line-dash-pattern": [8, 4], label: "data(label)", color: c("--esc") } },
      { selector: "edge.advisory", style: { "line-style": "dashed", opacity: 0.5 } },
      { selector: "edge.holds", style: { width: 1, "target-arrow-shape": "none", opacity: 0.3 } },
      { selector: "edge.samecol", style: { "curve-style": "unbundled-bezier", "control-point-distances": [-80], "control-point-weights": [0.5] } },
      { selector: ".dim", style: { opacity: 0.15 } },
      { selector: "edge.hl", style: { label: "data(label)", opacity: 1 } },
    ];
  }
  function legendHTML() {
    const sw = (col, shape) => `<span style="display:inline-block;width:16px;height:12px;border:1.5px solid ${col};border-radius:${shape === "pill" ? 6 : 3}px;background:${col}22"></span>`;
    return `<div class="tt">Reading the rule graph</div>
      <div class="row2">${sw(GC.alert)} Alert (monitoring rule that fired)</div>
      <div class="row2">${sw(GC.evidence)} Evidence: document, transaction, list entry</div>
      <div class="row2">${sw(css("--close"))} Fact the engine proved (green pass, red fail, amber open)</div>
      <div class="row2">${sw(GC.rule, "pill")} Reasoning rule (dashed = advisory, after the decision)</div>
      <div class="row2">${sw(css("--rfi"))} Verdict</div>
      <div class="row2"><span style="display:inline-block;width:22px;border-top:2.5px dashed ${css("--esc")}"></span> contradicts</div>
      <p class="note" style="margin:8px 0 0">Classes and edge names come from system/ontology/proof.owl. Hover a node to trace it; click a document to open it.</p>`;
  }
  function graph(el, r, d) {
    el.innerHTML = `<div class="card gcard"><div class="gtools"><div class="seg" id="gAll"><button data-a="0" class="${S.graphAll ? "" : "on"}">Deciding path</button><button data-a="1" class="${S.graphAll ? "on" : ""}">Show all facts</button></div>
      <span class="note">Ontology knowledge graph · ${esc(r.id)}</span><span class="sp"></span><button class="btn" id="gFit">Fit</button><button class="btn qmark" id="gHelp" data-pop="1" title="Legend">?</button></div>
      <div style="position:relative"><div id="cy"></div><div class="gtip" id="gtip"></div></div></div>`;
    $$("#gAll button").forEach((b) => (b.onclick = () => { S.graphAll = b.dataset.a === "1"; graph(el, r, d); }));
    $("#gHelp").onclick = (e) => { e.stopPropagation(); $("#pop").classList.contains("show") ? hidePop() : showPop(e.currentTarget, legendHTML()); };
    const cy = cytoscape({ container: $("#cy"), style: cyStyle(), elements: graphElements(r, d, S.graphAll), minZoom: 0.25, maxZoom: 2.5, boxSelectionEnabled: false, autoungrabify: false });
    S.cy = cy;
    const layEdges = cy.edges().filter((e) => e.source().data("col") !== e.target().data("col"));
    cy.edges().difference(layEdges).addClass("samecol");
    cy.nodes().union(layEdges).layout({ name: "dagre", rankDir: "LR", nodeSep: 26, rankSep: 110, animate: false, fit: false,
      minLen: (e) => Math.max(1, e.target().data("col") - e.source().data("col")) }).run();
    // column order from the ontology (alert → evidence → fact → rule → verdict), even spacing inside a column
    const order = [...new Set(cy.nodes().map((n) => n.data("col")))].sort((a, b) => a - b);
    let x0 = 0;
    order.forEach((c) => {
      const col = cy.nodes().filter((n) => n.data("col") === c).sort((a, b) => a.position("y") - b.position("y"));
      const per = 9, k = Math.ceil(col.length / per), rows = Math.ceil(col.length / k);
      const wmax = Math.max(...col.map((n) => n.outerWidth()));
      const hs = col.map((n) => n.outerHeight()), step = Math.max(...hs) + 26, h = (rows - 1) * step;
      col.forEach((n, i) => n.position({ x: x0 + (i % k) * (wmax + 24) + wmax / 2, y: Math.floor(i / k) * step - h / 2 + (k > 1 ? (i % k) * (step / 2) : 0) }));
      x0 += k * (wmax + 24) + 56;
    });
    cy.fit(cy.elements(), 40);
    if (cy.zoom() > 1.15) { cy.zoom(1.15); cy.center(); }
    const tip = $("#gtip");
    cy.on("mouseover", "node", (e) => {
      const n = e.target, keep = n.closedNeighborhood();
      cy.elements().addClass("dim"); keep.removeClass("dim").addClass("hl");
      const t = n.data("type");
      let body = `<div class="tt">${esc(n.data("label").split("\n")[0])}</div><div class="note">${esc(n.data("cls"))} · ${esc(n.id())}</div>`;
      if (t === "rule") body += `<div style="margin-top:6px">${esc(ruleText(n.data("rule"))[1])}</div><div class="note" style="margin-top:4px">${esc(n.data("kind"))} rule · outcome ${esc(n.data("outcome"))}</div>`;
      if (t === "fact" && n.data("tip")) body += `<div class="mono" style="margin-top:6px;white-space:pre-wrap;font-size:12px">${esc(n.data("tip"))}</div>`;
      if (t === "evidence" && n.data("tip") && n.data("tip") !== n.id()) body += `<div style="margin-top:6px">${esc(n.data("tip"))}</div>`;
      tip.innerHTML = body; tip.classList.add("show");
      const p = e.renderedPosition, W = $("#cy").clientWidth;
      tip.style.left = Math.min(p.x + 18, W - 330) + "px"; tip.style.top = Math.max(8, p.y - 10) + "px";
    });
    cy.on("mouseout", "node", () => { cy.elements().removeClass("dim hl"); tip.classList.remove("show"); });
    cy.on("tap", "node", (e) => { const id = e.target.id(); if (d.docs.some((x) => x.id === id)) go(`#/case/${r.id}/documents/${id}`); });
    $("#gFit").onclick = () => cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 200 });
  }

  /* ---------- Documents ---------- */
  function tabDocs(el, r, d, rest) {
    const cited = new Set(d.out.evidence), dec = deciding(d);
    const docs = d.docs.slice().sort((a, b) => (cited.has(b.id) - cited.has(a.id)) || (a.boiler - b.boiler) || (a.id < b.id ? -1 : 1));
    const sel = rest[0] && docs.some((x) => x.id === rest[0]) ? rest[0] : (docs.find((x) => cited.has(x.id)) || docs[0] || {}).id;
    if (!docs.length) { el.innerHTML = `<div class="card empty"><h2>No documents</h2><p>Nothing is on file for this customer.</p></div>`; return; }
    el.innerHTML = `<div class="docs"><div class="doclist">${docs.map((x) => `<a href="#/case/${r.id}/documents/${x.id}" class="${x.id === sel ? "on" : ""}" style="${x.boiler ? "opacity:.6" : ""}"><div class="id">${x.id}${cited.has(x.id) ? `<span class="cited">${dec.has(x.id) ? "◆ deciding" : "cited"}</span>` : ""}</div><div class="d">${esc(x.title || x.type.replace(/_/g, " "))}</div><div class="d note">${esc(docClass(x.type))}${x.dated ? " · " + esc(x.dated) : ""}</div></a>`).join("")}</div>
      <div class="card"><div id="docMeta" class="note" style="margin-bottom:14px"></div><div class="docbody" id="docBody"></div></div></div>`;
    const doc = docs.find((x) => x.id === sel);
    $("#docMeta").innerHTML = `<span class="mono">${doc.id}</span> · ${esc(docClass(doc.type))} · ${esc(doc.type)} &nbsp; <span style="color:${css("--close")}">▆</span> supports the decision &nbsp; <span style="color:${css("--esc")}">▆</span> contradicts`;
    const body = $("#docBody");
    body.innerHTML = window.marked ? marked.parse(doc.md || "*(no source text)*") : "<pre>" + esc(doc.md) + "</pre>";
    highlightIn(body, doc.hl || { sup: [], con: [] });
  }
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

  /* ---------- Timeline ---------- */
  function tabTimeline(el, r, d) {
    const tl = d.timeline;
    if (!tl.length) { el.innerHTML = `<div class="card empty"><h2>No transactions</h2></div>`; return; }
    el.innerHTML = `<div class="card tl"><h2>Money in and out</h2><p class="hint">Bars above the line are money in, below are money out. Blue bars are the alerted transactions${d.case.held ? "; red is the held payment" : ""}. The shaded band is the review window.</p><div id="tlSvg"></div></div>
      <div class="card tblwrap" style="margin-top:20px"><table class="tbl"><thead><tr><th>Date</th><th>Transaction</th><th>Counterparty</th><th>Reference</th><th class="r">Amount</th><th></th></tr></thead><tbody>${tl.slice().reverse().map((t) => `<tr${t.alerted ? "" : ' style="color:var(--sub)"'}><td class="num">${t.at.slice(0, 10)}</td><td class="cid">${t.id}</td><td>${esc(t.cp)}${t.cc ? ` <span class="muted">${esc(t.cc)}</span>` : ""}</td><td class="muted">${esc(t.ref || t.ch || "")}</td><td class="r num">${t.dir === "in" ? "+" : "−"}${gbp(t.amt)}</td><td>${t.id === d.case.held ? '<span class="chip" style="color:var(--esc)">held</span>' : t.alerted ? '<span class="chip" style="color:var(--accent)">alerted</span>' : ""}</td></tr>`).join("")}</tbody></table></div>`;
    const wrap = $("#tlSvg"), W = wrap.clientWidth || 1100, H = 220, mid = 110;
    const t0 = Date.parse(tl[0].at), t1 = Date.parse(tl[tl.length - 1].at), span = Math.max(1, t1 - t0);
    const maxA = Math.max(...tl.map((x) => x.amt)), h = (a) => 4 + 90 * Math.sqrt(a / maxA);
    const x = (t) => 20 + ((Date.parse(t) - t0) / span) * (W - 40);
    const win = d.case.window || {};
    let svg = `<svg width="${W}" height="${H + 22}" xmlns="http://www.w3.org/2000/svg">`;
    if (win.from) { const a = x(win.from + "T00:00:00Z"), b = x((win.to || win.from) + "T23:59:59Z"); svg += `<rect x="${Math.max(0, a)}" y="0" width="${Math.max(2, Math.min(W, b) - Math.max(0, a))}" height="${H}" fill="${css("--panel-2")}" rx="6"/><text x="${Math.max(6, a + 8)}" y="16" fill="${css("--faint")}" font-size="12" font-family="Plex Sans">review window</text>`; }
    svg += `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="${css("--line-2")}"/>`;
    const months = new Set();
    tl.forEach((t) => { const m = t.at.slice(0, 7); if (!months.has(m)) { months.add(m); const xx = x(m + "-01T00:00:00Z"); if (xx > 0) svg += `<text x="${xx + 3}" y="${H + 16}" fill="${css("--faint")}" font-size="12" font-family="Plex Sans">${new Date(m + "-01").toLocaleString("en-GB", { month: "short", year: "numeric" })}</text>`; } });
    tl.forEach((t) => {
      const hh = h(t.amt), xx = x(t.at), up = t.dir === "in", held = t.id === d.case.held;
      svg += `<rect class="tlbar" x="${xx - 3}" y="${up ? mid - hh : mid}" width="6" height="${hh}" rx="2" fill="${held ? css("--esc") : t.alerted ? css("--accent") : "#3B4A61"}"><title>${esc(t.at.slice(0, 10))}  ${esc(gbp(t.amt))} ${t.dir}  ${esc(t.cp)}  ${t.id}${t.alerted ? " · alerted" : ""}</title></rect>`;
    });
    wrap.innerHTML = svg + "</svg>";
  }

  /* ---------- Rules ---------- */
  function pageRules(main) {
    const fired = {}; S.rows.forEach((r) => (r.fired || []).forEach((f) => (fired[f] = (fired[f] || 0) + 1)));
    const tms = {}; S.rows.forEach((r) => [...new Set(r.rules)].forEach((x) => (tms[x] = (tms[x] || 0) + 1)));
    const order = ["Suspicion", "Watch-list", "Explanation", "Reconciliation", "Decision"];
    const list = Object.entries(fired).sort((a, b) => order.indexOf(ruleKind(a[0])) - order.indexOf(ruleKind(b[0])) || b[1] - a[1]);
    const step = (n, t, p, out) => `<div class="step"><div class="n">${n}</div><h3>${t}</h3><p>${p}</p><div class="out">${out}</div></div>`;
    main.innerHTML = page(ph("Rules", `How the engine turns facts into a verdict · counts for ${esc(instLabel(S.inst))}`) + `
      <div class="card" style="margin-bottom:20px"><h2>The verdict ladder</h2><p class="hint">Rules run in this order. The first step that settles the case decides it.</p>
        <div class="ladder">
          ${step("STEP 1", "Look for red flags", "Suspicion rules read the documents and transactions: mule signs, structuring, pass-through, invoices that disagree, unexplained high-risk corridors.", pill("ESCALATE") + ' <span class="note">if any red flag is proved</span>')}
          ${step("STEP 2", "Resolve watch-list matches", "A TM22 match is tested on name plus date of birth or company role at the time of payment.", pill("ESCALATE") + " " + pill("CLOSE") + " " + pill("RFI"))}
          ${step("STEP 3", "Explain every alerted pound", "Each alert is reconciled: documents that state the exact amount and party, own-account proofs, declared profile.", '<span class="note">explained / within profile / open</span>')}
          ${step("STEP 4", "Decide", "All alerts reconciled closes the case. Anything still open asks the customer for the one missing document.", pill("CLOSE") + " " + pill("RFI"))}
        </div></div>
      <div class="grid g-main"><div class="card tblwrap"><h2 style="padding:14px 4px 0">Reasoning rules</h2><p class="hint" style="padding:0 4px">How many ${esc(instLabel(S.inst))} cases each rule fired on (decisions only, not advisory).</p>
        <table class="tbl"><thead><tr><th>Rule</th><th>Kind</th><th class="r">Cases</th></tr></thead><tbody>${list.map(([k, n]) => `<tr><td><div>${esc(ruleText(k)[0])}</div><div class="muted mono">${esc(k)}</div><div class="muted">${esc(ruleText(k)[1])}</div></td><td class="sub2">${ruleKind(k)}</td><td class="r num">${n0(n)}</td></tr>`).join("")}</tbody></table></div>
        <div class="stack"><div class="card"><h2>Monitoring rules</h2><p class="hint">The alerts that open cases, from POLICY.md.</p><div class="list">${Object.entries(tms).sort().map(([k, n]) => `<div class="li"><div><div class="t"><span class="mono">${k}</span> ${esc(tmWords(k))}</div></div><div class="num">${n0(n)}</div></div>`).join("")}</div></div>
          <div class="card"><h2>Ontology classes</h2><p class="hint">system/ontology/proof.owl types every node and edge in the proof.</p><pre class="tree">${ONTO.tree ? esc(ONTO.tree).replace(/^(\s*(?:└ )?)([A-Z]\w+)/gm, '$1<span style="color:var(--text)">$2</span>') : "proof.owl not bundled"}</pre></div></div></div>`);
  }

  /* ---------- About ---------- */
  function pageAbout(main) {
    const runs = S.data.runs || [];
    const st = (n, t, p) => `<div class="step"><div class="n">${n}</div><h3>${t}</h3><p>${p}</p></div>`;
    main.innerHTML = page(ph("How it works", "A reasoning engine, not a guessing engine.") + `
      <div class="pipe" style="margin-bottom:20px">
        ${st("1", "Normalise", "Read the institution folder: cases, alerts, customers, transactions, documents, list, prior reviews. Fix encodings and formats.")}
        ${st("2", "Extract facts", "Pull amounts, dates, names and roles from structured fields and the markdown documents. Every fact keeps its source IDs.")}
        ${st("3", "Apply rules", "Suspicion, watch-list, explanation and reconciliation rules fire on those facts, in a fixed order.")}
        ${st("4", "Verdict", "Close, RFI or Escalate, with a reason code and a templated reason that names the documents and amounts.")}
        ${st("5", "Proof", "The full trace is saved as a knowledge graph typed by the OWL ontology (trace.jsonl and .kg.ttl).")}
        ${st("6", "Brief", "An optional plain-English summary, written from the proof and fact-checked. Never scored.")}
      </div>
      <div class="grid g2">
        <div class="card"><h2>Deterministic</h2><p class="hint">No randomness, no network, no model in the scored path. Same input, same bytes.</p>
          ${runs.length ? `<table class="tbl"><thead><tr><th>Run</th><th>Verdict + code hash</th><th>File sha256</th></tr></thead><tbody>${runs.map((r) => `<tr><td class="num">${r.run}</td><td class="cid">${r.verdict_code_hash}</td><td class="cid">${r.file_hash.slice(0, 16)}…</td></tr>`).join("")}</tbody></table>` : '<p class="note">No repeat runs in this bundle.</p>'}</div>
        <div class="stack">
          <div class="card"><h2>Evidence you can check</h2><p class="hint" style="margin:0">Every cited ID is checked against the case's own records before it is written. Each fact points back to the documents it came from, and the Documents tab highlights the exact words.</p></div>
          <div class="card"><h2>Fact-checked briefs</h2><p class="hint" style="margin:0">A brief is kept only if every amount, ID and name in it appears in the proof. Anything else is dropped and logged.</p></div>
          <div class="card"><h2>Policy changes are approved</h2><p class="hint" style="margin:0">Thresholds can be tried out on the Import page. A change only applies to the next run once someone approves it and its override file is passed to <span class="mono">system/run --policy=</span>. Defaults stay as written in POLICY.md.</p></div>
        </div></div>`);
  }

  /* ---------- Import (placeholder until the in-browser engine lands) ---------- */
  function pageImport(main) {
    if (window.PG_IMPORT) return window.PG_IMPORT(main, API);
    main.innerHTML = page(ph("Import", "Run the engine on your own data") + `<div class="card empty"><h2>Coming soon</h2><p>Drop an institution folder and run system/run in the browser.</p></div>`);
  }

  /* ---------- keyboard + boot ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) { if (e.key === "Escape") e.target.blur(); return; }
    const r = parseHash();
    if (e.key === "Escape") { hidePop(); }
    if (e.key === "f" && S.cy && r.page === "case") S.cy.fit(S.cy.elements(), 40);
    if ((e.key === "j" || e.key === "k") && r.page === "case" && S.visible) {
      const i = S.visible.findIndex((x) => x.id === r.args[0]); const nx = S.visible[i + (e.key === "j" ? 1 : -1)];
      if (nx) go("#/case/" + nx.id + (r.args[1] ? "/" + r.args[1] : ""));
    }
  });
  const API = { S, $, $$, esc, gbp, gbp0, n0, css, page, ph, pill, words, counts, mixBar, instLabel, renderSide, setInst, go, route, londonTime };
  window.PROOF = { state: S, go, setInst, startReplay, stopReplay, api: API };
  route();
})();
