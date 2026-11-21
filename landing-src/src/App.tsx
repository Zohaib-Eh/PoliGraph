import { motion } from "motion/react";
import {
  ArrowRight, ArrowUpRight, Check, Minus, FolderOpen, Type, Network, GitBranch, Scale, FileCheck2,
  LayoutDashboard, ListOrdered, Workflow, Upload, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GridBackground, Spotlight, Reveal, NumberTicker, SpotlightCard, Beam } from "@/components/effects";
import { cn } from "@/lib/utils";

const APP = "index.html#/overview";
const CASE = "index.html#/case/BK-CS125943/why";
const GH = "https://github.com/Zohaib-Eh/PoliGraph";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="#7EB6FF" stroke="#7EB6FF" strokeWidth={1.4} aria-hidden>
      <circle cx="5" cy="12" r="2.4" /><circle cx="12" cy="5" r="2.4" /><circle cx="12" cy="19" r="2.4" /><circle cx="19" cy="12" r="2.4" />
      <path fill="none" d="M7 11l3.4-4.2M7 13l3.4 4.2M14 6.8l3.4 4.2M14 17.2l3.4-4.2" />
    </svg>
  );
}

function GithubMark() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>;
}

function Nav() {
  const links = [["Problem", "#problem"], ["How it works", "#how"], ["Why reasoning", "#why"], ["Results", "#results"], ["The app", "#inside"]];
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <a href="#top" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"><Logo />PoliGraph</a>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Sections">
          {links.map(([l, h]) => <a key={h} href={h} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">{l}</a>)}
        </nav>
        <Button asChild size="sm" className="ml-auto md:ml-2"><a href={APP}>Open the app</a></Button>
      </div>
    </header>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mb-12 max-w-2xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-[.18em] text-brand">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-pretty text-[17px] leading-relaxed text-muted-foreground">{sub}</p>}
    </Reveal>
  );
}

/* ---------------- hero ---------------- */
const proof = [
  { k: "fact", t: <>Payment <span className="text-foreground">BK-T756068985</span>: £1,800.00 from Elmcote Consulting Ltd, 15 Sep 2026</> },
  { k: "fact", t: <>List entry <span className="text-foreground">BK-L71137</span> matches officer Emery Draycote on name and birth month and year</> },
  { k: "fact", t: <><span className="text-foreground">PSC-5155</span>: Emery Draycote held 60% of the company until 17 Sep 2026</> },
  { k: "rule", t: <>Listed party controlled the payer when it paid → suspicion</> },
  { k: "verdict", t: <>Suspicion outranks everything → <span className="text-rose-300">ESCALATE</span> · ESC_LISTED_PARTY</> },
];

function ProofWindow() {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35, ease: [0.2, 0, 0, 1] }}
      className="relative mx-auto mt-16 max-w-3xl">
      <div aria-hidden className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/15 to-white/0" />
      <div className="relative overflow-hidden rounded-2xl bg-[#0c0c0f] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-white/[.06] px-4 py-3">
          <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-white/10" />)}</div>
          <span className="truncate font-mono text-xs text-muted-foreground">case / BK-CS125943<span className="hidden sm:inline"> / proof</span></span>
          <Badge variant="esc" className="ml-auto">ESCALATE</Badge>
        </div>
        <ol className="space-y-0 px-5 py-4 text-left font-mono text-[12.5px] leading-relaxed text-muted-foreground">
          {proof.map((p, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.18, duration: 0.4 }}
              className="flex gap-3 border-b border-white/[.04] py-2 last:border-0">
              <span className={cn("w-14 shrink-0", p.k === "fact" ? "text-sky-300/70" : p.k === "rule" ? "text-amber-300/80" : "text-rose-300/90")}>{p.k}</span>
              <span>{p.t}</span>
            </motion.li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[.06] bg-white/[.015] px-5 py-3 font-mono text-[11px] text-muted-foreground">
          <span className="mr-1">evidence</span>
          {["BK-AL2932422", "BK-L71137", "BK-T756068985", "PSC-5155", "REG-6142"].map((e) => <span key={e} className="rounded border border-white/[.08] px-1.5 py-0.5">{e}</span>)}
        </div>
      </div>
    </motion.div>
  );
}

function Hero() {
  const up = (d: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease: [0.2, 0, 0, 1] as const } });
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <GridBackground className="-z-10" />
      <div className="-z-10"><Spotlight /></div>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-28">
        <motion.a {...up(0)} href="#how" className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[.03] py-1.5 pl-1.5 pr-3.5 text-xs text-muted-foreground transition-colors hover:border-white/20">
          <span className="relative ml-1.5 flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
          Transaction-monitoring alert triage, with proofs <ArrowRight className="size-3" />
        </motion.a>
        <motion.h1 {...up(0.08)} className="mx-auto mt-7 max-w-4xl text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] md:text-[76px]">
          A reasoning engine,{" "}
          <span className="bg-gradient-to-b from-white/90 to-white/40 bg-clip-text text-transparent">not a guessing engine.</span>
        </motion.h1>
        <motion.p {...up(0.16)} className="mx-auto mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground md:text-lg">
          PoliGraph triages transaction-monitoring alerts into{" "}
          <Badge variant="close">CLOSE</Badge>, <Badge variant="rfi">RFI</Badge> or <Badge variant="esc">ESCALATE</Badge>, with a proof for every decision.
        </motion.p>
        <motion.div {...up(0.24)} className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><a href={APP}>Open the app <ArrowRight /></a></Button>
          <Button asChild size="lg" variant="outline"><a href={CASE}>See a decision</a></Button>
        </motion.div>
        <ProofWindow />
        <p className="mx-auto mt-5 max-w-xl text-[13px] text-muted-foreground/80">
          A real case from the development set. The owner on the watch list stepped down two days <em>after</em> the payment, so they still controlled the payer.
        </p>
      </div>
    </section>
  );
}

/* ---------------- problem ---------------- */
function Problem() {
  const stats = [
    { v: <><NumberTicker value={85} />–<NumberTicker value={95} />%</>, t: "of transaction-monitoring alerts are false positives", s: "Industry estimates (Oztas et al. 2024; Everest Group / Capgemini 2025; SWIFT Institute 2021), not an FCA statistic" },
    { v: <><NumberTicker value={30} />–<NumberTicker value={45} /> min</>, t: "average Level 1 review time per alert", s: "Everest Group / Capgemini, Dec 2025" },
    { v: <NumberTicker value={576.4} decimals={1} prefix="£" suffix="m" />, t: "lost to APP fraud in the UK in 2025, up 19% in a year", s: "UK Finance, Annual Fraud Report 2026" },
    { v: <NumberTicker value={238396} />, t: "suspected mule accounts closed by FCA-regulated firms in 2025", s: "FCA, 23 Sep 2026" },
  ];
  const fines = [
    ["Nationwide", "£44.1m", "Dec 2025", "Ineffective due diligence, risk assessment and transaction monitoring"],
    ["Monzo", "£21.1m", "Jul 2025", "Including inadequate transaction monitoring systems"],
    ["Metro Bank", "£16.7m", "Nov 2024", "More than 60 million transactions, worth over £51bn, not monitored"],
  ];
  return (
    <section id="problem" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHead eyebrow="The problem" title="Most alerts are explained. Every one still needs an analyst."
        sub="Queues grow faster than teams. Real crime hides in the noise, and firms that fall behind end up in front of the regulator." />
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 0.05} className="flex flex-col bg-background p-6">
            <div className="text-3xl font-semibold tracking-tight md:text-4xl">{s.v}</div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">{s.t}</p>
            <p className="mt-auto pt-5 text-[11.5px] leading-snug text-muted-foreground/70">{s.s}</p>
          </Reveal>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Reveal className="flex flex-col rounded-xl border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Since 7 Oct 2024</p>
          <p className="mt-5 text-4xl font-semibold tracking-tight">£85,000</p>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">Maximum reimbursement per eligible APP-scam claim, and the receiving firm pays <span className="font-semibold text-foreground">50%</span>. Catching a mule is also a reimbursement you don't pay.</p>
          <p className="mt-auto pt-4 text-[11.5px] text-muted-foreground/70">Payment Systems Regulator</p>
        </Reveal>
        <Reveal delay={0.05} className="rounded-xl border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">FCA fines where monitoring fell short</p>
          <ul className="mt-3 divide-y divide-border">
            {fines.map(([f, a, d, w]) => (
              <li key={f} className="grid grid-cols-[1fr_auto] gap-x-4 py-3 sm:grid-cols-[120px_80px_1fr]">
                <span className="font-medium">{f}</span>
                <span className="text-right font-mono text-rose-300 sm:text-left">{a}</span>
                <span className="col-span-2 text-sm text-muted-foreground sm:col-span-1">{w} <span className="text-muted-foreground/60">· {d}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-muted-foreground/70">Source: FCA press releases</p>
        </Reveal>
      </div>
      <Reveal className="mt-16 max-w-3xl">
        <p className="text-balance text-2xl font-medium leading-snug tracking-tight text-foreground/90 md:text-[28px]">
          The job isn't to raise more alerts. <span className="text-muted-foreground">It's to close the explained ones safely, and never miss the ones that aren't.</span>
        </p>
      </Reveal>
    </section>
  );
}

/* ---------------- how it works ---------------- */
const steps = [
  { i: FolderOpen, t: "Case folder", d: "Alerts, transactions and documents for one customer." },
  { i: Type, t: "Normalise", d: "A fixed, documented table. GBP → £, dates, labels. No LLM." },
  { i: Network, t: "Knowledge graph", d: "Every fact typed against an OWL ontology." },
  { i: GitBranch, t: "Rules", d: "Datalog-style, closed world. Every alert reconciled to £0." },
  { i: Scale, t: "Verdict ladder", d: "Suspicion first, then anything unsettled, then CLOSE." },
  { i: FileCheck2, t: "Proof + reason", d: "Evidence IDs and plain English. An LLM only rephrases." },
];
function How() {
  return (
    <section id="how" className="relative border-y border-border bg-[#0b0b0e]">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <SectionHead eyebrow="How it works" title="One deterministic pipeline. No model makes the call."
          sub="The same input always gives the same verdict and the same proof. Language models never touch the decision." />
        <div className="flex flex-col items-stretch lg:flex-row">
          {steps.map((s, i) => (
            <div key={s.t} className="flex flex-col items-center lg:flex-1 lg:flex-row lg:items-stretch">
              <Reveal delay={i * 0.06} className="w-full lg:h-full">
                <div className={cn("relative h-full rounded-xl border bg-card p-4", i === 4 ? "border-brand/40 shadow-[0_0_40px_-12px_#7eb6ff55]" : "border-border")}>
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[.03]"><s.i className="size-4 text-brand" /></span>
                    <span className="font-mono text-[11px] text-muted-foreground/60">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-medium">{s.t}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              </Reveal>
              {i < steps.length - 1 && (<><Beam className="hidden w-6 shrink-0 self-center lg:block" /><Beam vertical className="lg:hidden" /></>)}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { b: "esc" as const, l: "ESCALATE", h: "Any suspicion", d: "A listed party, a mule pattern, a fraud report, a contradiction. Suspicion always wins, even when the money balances." },
            { b: "rfi" as const, l: "RFI", h: "Anything unsettled", d: "Money left unexplained and nothing criminal. Ask for one specific document, and say why." },
            { b: "close" as const, l: "CLOSE", h: "£0 unexplained", d: "Every alerted pound matched to evidence: an invoice exact to the penny, an own-account statement, a documented event." },
          ].map((r, i) => (
            <Reveal key={r.l} delay={i * 0.06} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3"><Badge variant={r.b}>{r.l}</Badge><span className="text-sm font-medium">{r.h}</span></div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- why ---------------- */
const rows = [
  ["Explainability", "A proof: which rule fired, on which facts, from which documents", "A score, with feature-importance estimates after the fact"],
  ["Reproducibility", "Byte-identical output on every rerun", "Shifts with model version, retraining and thresholds"],
  ["Auditability", "Every verdict cites the evidence IDs it relied on", "Hard to show why one specific alert was closed"],
  ["Training data", "None. Rules come from written policy, no labels needed", "Large volumes of labelled historical alerts"],
  ["Policy changes", "Instant. Previewed with a what-if, logged on approval", "Retrain, revalidate, redeploy"],
  ["When unsure", "Unknown means RFI, never a silent CLOSE", "A confident score can still be wrong, without warning"],
  ["Drift", "None. Rules change only when someone approves it", "Performance decays as behaviour changes"],
];
function Why() {
  return (
    <section id="why" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHead eyebrow="Why reasoning" title="A model gives you a number. A regulator asks for a reason." />
      <Reveal className="overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[19%] pl-6" />
              <TableHead className="text-foreground"><span className="inline-flex items-center gap-2"><Logo className="size-4" />PoliGraph</span></TableHead>
              <TableHead>Typical ML risk score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([k, us, them]) => (
              <TableRow key={k}>
                <TableCell className="pl-6 font-medium">{k}</TableCell>
                <TableCell><span className="flex gap-2.5 text-foreground/90"><Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />{us}</span></TableCell>
                <TableCell><span className="flex gap-2.5 text-muted-foreground"><Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />{them}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Reveal>
      <Reveal className="mt-6 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Where ML helps:</span> finding new patterns in large volumes of data. PoliGraph doesn't compete with that. A pattern found by ML can become a new rule here, once a human has reviewed and approved it.
      </Reveal>
    </section>
  );
}

/* ---------------- results ---------------- */
function Results() {
  const items = [
    { v: <NumberTicker value={4000} />, l: "development cases", d: "Bank, e-money, investment, and payments & FX. 1,000 each.", c: "lg:col-span-2" },
    { v: <NumberTicker value={0.92} decimals={2} suffix=" s" />, l: "for 200 cases", d: "About 2.3 s per 1,000. The limit is 30 minutes." },
    { v: <><NumberTicker value={5} /> / 5</>, l: "reruns byte-identical", d: "Same input, same bytes out." },
    { v: <NumberTicker value={0} />, l: "wrong closes under stress", d: "Thousands of reworded cases, plus adversarial ones: changed payee, injected fraud reports, removed documents, malformed data.", c: "lg:col-span-2", hl: true },
    { v: <><NumberTicker value={78} /> / 80</>, l: "agreed in blind review", d: "97.5%, with 0 unsafe closes." },
    { v: <><NumberTicker value={92} />–100%</>, l: "lower cost than escalate-all", d: "Estimated cost 13 (0–3 after a second look) vs 162." },
  ];
  return (
    <section id="results" className="border-t border-border bg-[#0b0b0e]">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <SectionHead eyebrow="Results" title="Measured on the development set."
          sub="There are no ground-truth labels, so these come from a blind review and stress tests, not a scored answer key." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((s, i) => (
            <Reveal key={i} delay={i * 0.04} className={cn("rounded-xl border border-border bg-card p-6", s.c, s.hl && "relative overflow-hidden")}>
              {s.hl && <div aria-hidden className="absolute -right-16 -top-16 size-48 rounded-full bg-emerald-400/10 blur-3xl" />}
              <div className={cn("relative text-4xl font-semibold tracking-tight md:text-5xl", s.hl && "text-emerald-300")}>{s.v}</div>
              <p className="relative mt-2 text-sm font-medium">{s.l}</p>
              <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.d}</p>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground/70">
          Sources: internal audit reports (blind audit of 80 cases; round 3 robustness audit and fixes). Single reviewer, no ground truth: agreement shows consistency, not proven accuracy.
        </p>
      </div>
    </section>
  );
}

/* ---------------- inside ---------------- */
function Inside() {
  const cards = [
    { i: LayoutDashboard, t: "Overview", d: "Verdict mix, reason codes and amounts across all four institutions.", h: "index.html#/overview", c: "md:col-span-2" },
    { i: ListOrdered, t: "Queue & replay", d: "Replay the alert queue as an operations floor and watch it clear.", h: "index.html#/queue" },
    { i: Workflow, t: "Why graphs", d: "Two views of every case: the Story for people, the Rule graph for auditors.", h: CASE },
    { i: Upload, t: "Import & policy what-if", d: "Run the real engine in your browser on new data. Preview a policy change, then approve it with an audit log.", h: "index.html#/import", c: "md:col-span-2" },
  ];
  return (
    <section id="inside" className="mx-auto max-w-6xl px-6 py-28">
      <SectionHead eyebrow="The app" title="Everything an analyst needs, nothing they don't." />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.t} delay={i * 0.05} className={c.c}>
            <a href={c.h} className="block h-full">
              <SpotlightCard className="h-full p-6">
                <div className="flex h-full flex-col">
                  <span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[.03]"><c.i className="size-4 text-brand" /></span>
                  <h3 className="mt-8 text-base font-medium">{c.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm text-foreground/80 transition-colors group-hover:text-brand">Open <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                </div>
              </SpotlightCard>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border">
      <GridBackground className="-z-10 [&>div]:[mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,#000_30%,transparent_100%)]" />
      <div className="mx-auto max-w-6xl px-6 py-28 text-center">
        <ShieldCheck className="mx-auto size-8 text-brand" />
        <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-[44px] md:leading-[1.1]">Close the explained ones. Never miss the rest.</h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><a href={APP}>Open the app <ArrowRight /></a></Button>
          <Button asChild size="lg" variant="outline"><a href={GH} rel="noopener"><GithubMark /> View on GitHub</a></Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Logo className="size-4" /><span className="text-foreground">PoliGraph</span> · A reasoning engine, not a guessing engine.</span>
        <span className="flex gap-6"><a className="hover:text-foreground" href={APP}>Open the app</a><a className="hover:text-foreground" href={GH} rel="noopener">GitHub</a></span>
      </div>
    </footer>
  );
}

export default function App() {
  return (<><Nav /><main><Hero /><Problem /><How /><Why /><Results /><Inside /><CTA /></main><Footer /></>);
}
