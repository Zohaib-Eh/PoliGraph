import { Fade } from "@/components/motion";
import { ProofStory } from "@/components/ProofStory";

const APP = "index.html#/overview";
const CASE = "index.html#/case/BK-CS125943/why";
const GH = "https://github.com/Zohaib-Eh/PoliGraph";
const Arrow = () => <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><path d="M0 5h13M9 1l4 4-4 4" /></svg>;

function Nav() {
  const links: [string, string][] = [["Problem", "#problem"], ["Method", "#method"], ["Verdict", "#verdict"], ["Proof vs score", "#compare"], ["Results", "#results"]];
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-[#050505]/85 backdrop-blur-md">
      <div className="wrap flex h-16 items-center">
        <a href="#top" className="display text-[17px] tracking-[0.08em]" style={{ lineHeight: 1 }}>PoliGraph</a>
        <nav className="mx-auto hidden gap-9 lg:flex" aria-label="Sections">
          {links.map(([l, h]) => <a key={h} href={h} className="ulink font-mono text-[13px] uppercase tracking-[0.08em] text-[#d6d6d6] hover:text-white">{l}</a>)}
        </nav>
        <a href={APP} className="textbtn ml-auto h-9 lg:ml-0">Open the app <Arrow /></a>
      </div>
    </header>
  );
}

function SectionLabel({ n, t }: { n: string; t: string }) {
  return <div className="label flex items-center gap-4"><span className="text-white">{n}</span><span className="h-px w-10 bg-white/30" /><span>{t}</span></div>;
}

function Hero() {
  const d = (x: number) => ({ animationDelay: `${x}s` });
  return (
    <section id="top" className="relative border-b border-line pt-16">
      <div className="wrap pb-12 pt-14 md:pb-16 lg:pt-20">
        <h1 style={d(0.1)} className="appear display text-[12vw] md:text-[7vw] lg:text-[min(5.4vw,84px)]">A reasoning engine,<br className="hidden md:block" /> not a guessing engine.</h1>
        <div style={d(0.3)} className="appear mt-8 grid gap-6 md:grid-cols-12 md:items-end">
          <p className="body md:col-span-6">
            PoliGraph triages transaction-monitoring alerts into CLOSE, RFI or ESCALATE, and proves every decision.
          </p>
          <div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end">
            <a href={APP} className="textbtn solid">Open the app <Arrow /></a>
            <a href={CASE} className="textbtn">See this decision <Arrow /></a>
          </div>
        </div>
        <div className="mt-14 border-t border-line pt-6 lg:mt-20">
          <div style={d(0.2)} className="appear mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <span className="label text-white">Fig. 0 · BK-CS125943</span>
            <span className="cap">The money balances. The owner on the watch list still held 60% when it was paid.</span>
          </div>
          <ProofStory />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const figs: [string, string, string][] = [
    ["£576.4M", "APP fraud losses, UK, 2025. Up 19%.", "UK Finance, 2026"],
    ["238,396", "Suspected mule accounts closed, 2025.", "FCA, Sep 2026"],
    ["30–45 MIN", "Average Level 1 review, per alert.", "Everest Group / Capgemini, 2025"],
    ["£85,000", "APP reimbursement cap per claim. Receiving firm pays 50%.", "PSR, from Oct 2024"],
  ];
  const fines: [string, string, string][] = [
    ["Nationwide", "£44.1M", "Dec 2025 · due diligence, risk assessment, transaction monitoring"],
    ["Monzo", "£21.1M", "Jul 2025 · incl. inadequate transaction monitoring systems"],
    ["Metro Bank", "£16.7M", "Nov 2024 · 60M+ transactions, over £51bn, not monitored"],
  ];
  return (
    <section id="problem" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="01" t="Problem" /></Fade>
        <div className="grid12 mt-16 gap-y-10">
          <Fade className="col-span-12 lg:col-span-7">
            <div className="display whitespace-nowrap text-[22vw] leading-[0.82] md:text-[13vw] lg:text-[11vw] xl:text-[168px]">85–95%</div>
          </Fade>
          <Fade delay={0.2} className="col-span-12 self-end lg:col-span-4 lg:col-start-9">
            <p className="display text-[28px] leading-[1.02] md:text-[36px]">of alerts are false positives. Each one still needs an analyst.</p>
            <p className="cap mt-5">Industry estimates (Oztas et al. 2024; Everest Group / Capgemini 2025; SWIFT Institute 2021). Not an FCA statistic.</p>
          </Fade>
        </div>
        <div className="mt-24 grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {figs.map(([v, t, s], i) => (
            <Fade key={v} delay={i * 0.12} className="border-b border-line py-8 sm:pr-8 lg:border-b-0 lg:border-r lg:pl-8 lg:first:pl-0 lg:last:border-r-0">
              <div className="display whitespace-nowrap text-[40px] xl:text-[52px]">{v}</div>
              <p className="cap mt-4 text-[16px] text-[#d6d6d6]">{t}</p>
              <p className="cap mt-3 text-[14px]">{s}</p>
            </Fade>
          ))}
        </div>
        <Fade className="mt-24 grid12 gap-y-6">
          <div className="col-span-12 lg:col-span-3"><p className="cap text-[16px] text-[#d6d6d6]">FCA fines where monitoring fell short</p></div>
          <ul className="col-span-12 lg:col-span-9">
            {fines.map(([f, a, w]) => (
              <li key={f} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t border-line py-5 last:border-b md:grid-cols-[220px_160px_1fr]">
                <span className="display text-[22px]">{f}</span>
                <span className="display text-right text-[22px] md:text-left">{a}</span>
                <span className="col-span-2 cap md:col-span-1">{w}</span>
              </li>
            ))}
          </ul>
        </Fade>
      </div>
    </section>
  );
}

const stages: [string, string, string][] = [
  ["Case folder", "Alerts, transactions, documents", "INPUT · ONE CUSTOMER"],
  ["Normalise", "Fixed table. No LLM.", "GBP→£ · DATES · LABELS"],
  ["Graph", "Facts typed in OWL", "ONTOLOGY · KG"],
  ["Rules", "Datalog, closed world", "SUSPICION · EXPLANATION · £0"],
  ["Ladder", "Suspicion first", "ESC > RFI > CLOSE"],
  ["Proof", "Evidence IDs + reason", "LLM REPHRASES ONLY"],
];
function Method() {
  return (
    <section id="method" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="02" t="Method" /></Fade>
        <Fade className="mt-16"><h2 className="display max-w-[16ch] text-[11vw] md:text-[6.2vw] xl:text-[88px]">Six stages. No model in the decision.</h2></Fade>
        {/* desktop schematic */}
        <div className="relative mt-24 hidden lg:block">
          <div className="mb-3 flex items-baseline justify-between"><span className="label">Fig. 1 · Pipeline</span><span className="cap">Deterministic, with byte-identical reruns</span></div>
          <div className="relative h-[220px] border-y border-line">
            <Fade className="absolute inset-x-0 top-[64px]"><div className="hline h-px origin-left bg-white/70" /></Fade>
            <div className="absolute inset-0 grid grid-cols-6">
              {stages.map(([t, d, a], i) => (
                <Fade key={t} delay={0.3 + i * 0.25} className="relative border-l border-line px-5 first:border-l-0 first:pl-0">
                  <div className="absolute top-[58px] size-[13px] -translate-x-[6px] border border-white bg-[#050505]" style={{ left: i === 0 ? 0 : 0 }} />
                  <div className="label pt-5">{String(i + 1).padStart(2, "0")}</div>
                  <div className="pt-[52px]">
                    <div className="display text-[22px]">{t}</div>
                    <p className="cap mt-2 text-[#d6d6d6]">{d}</p>
                    <p className="label mt-3 text-[13px] leading-snug tracking-[0.04em]">{a}</p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </div>
        {/* mobile schematic */}
        <ol className="mt-16 border-l border-white/40 lg:hidden">
          {stages.map(([t, d, a], i) => (
            <Fade as="li" key={t} className="relative pb-10 pl-8 last:pb-0">
              <span className="absolute -left-[7px] top-1 size-[13px] border border-white bg-[#050505]" />
              <div className="label">{String(i + 1).padStart(2, "0")} · {a}</div>
              <div className="display mt-2 text-[26px]">{t}</div>
              <p className="cap mt-1 text-[16px] text-[#d6d6d6]">{d}</p>
            </Fade>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Verdict() {
  const rows: [string, string, string, string][] = [
    ["Escalate", "Any suspicion", "Listed party, mule pattern, fraud report, contradiction. Wins even when the money balances.", "#c98b8b"],
    ["RFI", "Anything unsettled", "Money unexplained, nothing criminal. Ask for one specific document.", "#c9b48b"],
    ["Close", "£0 unexplained", "Every alerted pound matched to evidence. Invoices exact to the penny.", "#8bc9a8"],
  ];
  return (
    <section id="verdict" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="03" t="Verdict ladder" /></Fade>
        <div className="mt-16">
          {rows.map(([v, h, d, c], i) => (
            <Fade key={v} delay={i * 0.15} className="grid12 items-end gap-y-4 border-t border-line py-8 last:border-b md:py-10">
              <div className="col-span-12 flex items-baseline gap-5 md:col-span-7">
                <span className="label w-6">{i + 1}</span>
                <span className="display text-[16vw] leading-[0.85] md:text-[9vw] xl:text-[132px]">{v}</span>
              </div>
              <div className="col-span-12 md:col-span-4 md:col-start-9">
                <div className="label flex items-center gap-3 text-white"><span className="size-2" style={{ background: c }} />{h}</div>
                <p className="cap mt-3 text-[16px] text-[#d6d6d6]">{d}</p>
              </div>
            </Fade>
          ))}
        </div>
        <Fade className="mt-10"><p className="cap">Read top to bottom. The first rung that holds decides.</p></Fade>
      </div>
    </section>
  );
}

function Compare() {
  const rows: [string, string, string][] = [
    ["Explanation", "Proof: rule, facts, documents", "Score + post-hoc feature weights"],
    ["Reruns", "Byte-identical", "Shift with model and threshold"],
    ["Audit", "Every verdict cites evidence IDs", "Hard to justify one alert"],
    ["Training data", "None. Written policy", "Labelled historical alerts"],
    ["Policy change", "Instant. What-if, then logged approval", "Retrain, revalidate, redeploy"],
    ["When unsure", "RFI. Never a silent close", "Confident and wrong, no warning"],
    ["Drift", "None without approval", "Decays as behaviour changes"],
  ];
  return (
    <section id="compare" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="04" t="Proof vs score" /></Fade>
        <Fade className="mt-16"><h2 className="display max-w-[18ch] text-[11vw] md:text-[6.2vw] xl:text-[88px]">A model gives a number. A regulator asks for a reason.</h2></Fade>
        <Fade className="mt-20">
          <div className="grid grid-cols-[1fr_1fr] gap-x-6 border-b border-white/60 pb-3 md:grid-cols-[3fr_4fr_4fr]">
            <span className="label hidden md:block">Spec</span><span className="label text-white">PoliGraph</span><span className="label">ML risk score</span>
          </div>
          {rows.map(([k, a, b]) => (
            <div key={k} className="grid grid-cols-[1fr_1fr] gap-x-6 border-b border-line py-5 md:grid-cols-[3fr_4fr_4fr]">
              <span className="label col-span-2 mb-2 md:col-span-1 md:mb-0">{k}</span>
              <span className="text-[16px] leading-[1.5] text-white">{a}</span>
              <span className="text-[16px] leading-[1.5] text-dim">{b}</span>
            </div>
          ))}
          <p className="body mt-8">ML is good at finding new patterns. A pattern it finds can become a PoliGraph rule once a human approves it.</p>
        </Fade>
      </div>
    </section>
  );
}

function Results() {
  const figs: [string, string][] = [
    ["4,000", "Development cases, 4 institutions"],
    ["0.92 SEC", "200 cases. ~2.3 s per 1,000"],
    ["5 / 5", "Reruns byte-identical"],
    ["78 / 80", "Blind-review agreement (97.5%)"],
    ["92–100%", "Lower cost than escalate-all"],
  ];
  return (
    <section id="results" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="05" t="Results · development set" /></Fade>
        <div className="grid12 mt-16 gap-y-10">
          <Fade className="col-span-12 lg:col-span-6"><div className="display text-[48vw] leading-[0.78] md:text-[30vw] xl:text-[420px]">0</div></Fade>
          <Fade delay={0.2} className="col-span-12 self-end lg:col-span-5 lg:col-start-8">
            <p className="display text-[30px] leading-[1.02] md:text-[40px]">Wrong closes under stress.</p>
            <p className="body mt-5">Thousands of reworded cases, plus adversarial ones: changed payee, injected fraud reports, removed documents, malformed data.</p>
          </Fade>
        </div>
        <div className="mt-24 grid grid-cols-2 border-t border-line lg:grid-cols-5">
          {figs.map(([v, t], i) => (
            <Fade key={v} delay={i * 0.1} className="border-b border-line py-8 pr-4 lg:border-b-0 lg:border-r lg:pl-6 lg:first:pl-0 lg:last:border-r-0">
              <div className="display text-[34px] md:text-[44px]">{v}</div>
              <p className="cap mt-4 text-[#d6d6d6]">{t}</p>
            </Fade>
          ))}
        </div>
        <p className="cap mt-8 text-[14px]">No ground-truth labels. Figures from internal audits: blind review of 80 cases (single reviewer; estimated cost 13, or 0–3 after a second look, vs 162 for escalate-all) and round 3 robustness tests. Agreement shows consistency, not proven accuracy.</p>
      </div>
    </section>
  );
}

function Inside() {
  const items: [string, string, string][] = [
    ["Overview", "Verdict mix across all institutions", "index.html#/overview"],
    ["Queue", "Replay the alert floor in real time", "index.html#/queue"],
    ["Why", "Story graph and strict rule graph per case", CASE],
    ["Import", "Run the engine in-browser. Policy what-if with approval log", "index.html#/import"],
  ];
  return (
    <section id="inside" className="border-b border-line py-28 md:py-40">
      <div className="wrap">
        <Fade><SectionLabel n="06" t="The app" /></Fade>
        <ul className="mt-16 border-t border-line">
          {items.map(([t, d, h], i) => (
            <Fade as="li" key={t} delay={i * 0.1}>
              <a href={h} className="group grid12 items-baseline border-b border-line py-7 transition-colors hover:bg-white/[.03] md:py-9">
                <span className="label col-span-2 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <span className="display col-span-10 text-[40px] md:col-span-5 md:text-[64px]">{t}</span>
                <span className="col-span-10 col-start-3 cap mt-2 text-[16px] md:col-span-5 md:col-start-auto md:mt-0">{d}</span>
                <span className="col-span-1 hidden justify-self-end text-dim transition-transform group-hover:translate-x-1 group-hover:text-white md:block"><Arrow /></span>
              </a>
            </Fade>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="py-32 md:py-48">
      <div className="wrap">
        <Fade><h2 className="display max-w-[14ch] text-[12vw] md:text-[7vw] xl:text-[104px]">Close the explained. Never miss the rest.</h2></Fade>
        <Fade delay={0.3} className="mt-14 flex flex-wrap gap-3">
          <a href={APP} className="textbtn solid">Open the app <Arrow /></a>
          <a href={GH} rel="noopener" className="textbtn">GitHub <Arrow /></a>
        </Fade>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="wrap flex flex-wrap items-center justify-between gap-4 py-8">
        <span className="display text-[14px] tracking-[0.08em]" style={{ lineHeight: 1 }}>PoliGraph</span>
        <span className="cap">A reasoning engine, not a guessing engine.</span>
        <span className="flex gap-8"><a className="label ulink hover:text-white" href={APP}>App</a><a className="label ulink hover:text-white" href={GH} rel="noopener">GitHub</a></span>
      </div>
    </footer>
  );
}

export default function App() {
  return (<><Nav /><main><Hero /><Problem /><Method /><Verdict /><Compare /><Results /><Inside /><Close /></main><Footer /></>);
}
