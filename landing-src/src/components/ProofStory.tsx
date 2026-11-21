// Case BK-CS125943 rendered like the app's Why → Story view (same colours and card shapes).
// Content from the engine's story for this case (viewer data) and output/bank.jsonl.
const C = { panel: "#111722", panel2: "#161D2A", line: "#1C2433", line2: "#263042", text: "#E6EAF0", sub: "#9AA4B4", faint: "#647084", accent: "#7EB6FF", close: "#3DDC97", esc: "#FF6B85" };

function Arrow({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`grid place-items-center text-[18px] ${className}`} style={{ color: C.faint }}>→</div>;
}
const Head = ({ children }: { children: string }) => (
  <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: C.faint }}>{children}</div>
);

export function ProofStory({ className = "" }: { className?: string }) {
  const d = (x: number) => ({ animationDelay: `${x}s` });
  return (
    <figure className={`text-left ${className}`} aria-label="Case BK-CS125943: the listed owner still controlled the payee when it was paid, so the case escalates.">
      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1.55fr)_28px_minmax(0,1fr)]">
        {/* money in question */}
        <div className="appear" style={d(0.2)}>
          <Head>Money in question</Head>
          <div className="rounded-[14px] border p-5" style={{ background: C.panel, borderColor: C.line }}>
            <div className="font-mono text-[24px] leading-none" style={{ color: C.text }}>£1,800.00</div>
            <div className="mt-2 text-[14px]" style={{ color: C.sub }}>Internal watch-list match</div>
            <div className="mt-2 font-mono text-[12.5px]" style={{ color: C.faint }}>TM22 · BK-AL2932422</div>
          </div>
        </div>
        <Arrow className="appear rotate-90 lg:rotate-0" />
        {/* what we checked */}
        <div className="appear" style={d(0.6)}>
          <Head>What we checked</Head>
          <div className="space-y-2.5">
            <div className="flex gap-3 rounded-[12px] border p-4" style={{ background: `${C.esc}0d`, borderColor: `${C.esc}55` }}>
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: `${C.esc}22`, color: C.esc }}>✕</span>
              <div>
                <div className="text-[14.5px] font-medium leading-snug" style={{ color: "#FFD3DB" }}>Emery Draycote still controlled the payee when it was paid</div>
                <div className="mt-1 text-[13.5px] leading-snug" style={{ color: C.sub }}>Resigned as director 14 Sep, but held 60% until 17 Sep; the payment was on 15 Sep.</div>
                <div className="mt-2 font-mono text-[12.5px]" style={{ color: C.accent }}>PSC-5155 → &nbsp;REG-6142 →</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-[12px] border p-4" style={{ background: C.panel, borderColor: C.line2 }}>
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: `${C.close}1f`, color: C.close }}>✓</span>
              <div>
                <div className="text-[14.5px] font-medium leading-snug" style={{ color: C.text }}>Invoice INV-5407 matches £1,800.00</div>
                <div className="mt-1 text-[13.5px] leading-snug" style={{ color: C.sub }}>£1,800.00 to Elmcote Consulting Ltd on 15 Sep.</div>
              </div>
            </div>
          </div>
        </div>
        <Arrow className="appear rotate-90 lg:rotate-0" />
        {/* outcome */}
        <div className="appear" style={d(1.0)}>
          <Head>Outcome</Head>
          <div className="rounded-[14px] border p-5" style={{ background: C.panel, borderColor: C.line }}>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium" style={{ background: `${C.esc}1f`, color: C.esc }}>
              <span className="size-1.5 rounded-full" style={{ background: C.esc }} />Escalate
            </span>
            <div className="mt-3 text-[17px] font-semibold leading-snug" style={{ color: C.text }}>Listed party involved in the payment</div>
            <div className="mt-1.5 font-mono text-[12px]" style={{ color: C.faint }}>ESC_LISTED_PARTY</div>
            <div className="mt-3 text-[13px] leading-snug" style={{ color: C.sub }}>A red-flag rule fired. Escalation wins over any reconciliation.</div>
          </div>
        </div>
      </div>
    </figure>
  );
}
