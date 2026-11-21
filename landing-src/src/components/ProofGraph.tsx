// The director-trap case BK-CS125943 drawn as a thin-stroke knowledge graph. Facts from output/bank.jsonl.

type N = { id: string; x: number; y: number; k: string; t: string; s?: string; hot?: boolean };
const nodes: N[] = [
  { id: "C", x: 60, y: 90, k: "CUSTOMER", t: "BK-CS125943" },
  { id: "A", x: 330, y: 90, k: "ALERT", t: "BK-AL2932422" },
  { id: "T", x: 600, y: 90, k: "PAYMENT", t: "BK-T756068985", s: "£1,800.00 · 15 SEP 2026" },
  { id: "P", x: 600, y: 300, k: "PAYER", t: "ELMCOTE CONSULTING LTD", s: "REG-6142" },
  { id: "S", x: 330, y: 300, k: "CONTROL", t: "PSC-5155", s: "60% · UNTIL 17 SEP 2026" },
  { id: "L", x: 60, y: 300, k: "LIST ENTRY", t: "BK-L71137", s: "EMERY DRAYCOTE" },
  { id: "R", x: 330, y: 500, k: "RULE", t: "LISTED PARTY CONTROLS PAYER", s: "AT TIME OF PAYMENT" },
  { id: "V", x: 860, y: 500, k: "VERDICT", t: "ESCALATE", s: "ESC_LISTED_PARTY", hot: true },
];
const at = (id: string) => nodes.find((n) => n.id === id)!;
const edges: [string, string, string][] = [
  ["C", "A", "RAISED"], ["A", "T", "FLAGS"], ["T", "P", "PAID BY"], ["P", "S", "CONTROLLED BY"],
  ["S", "L", "MATCHES"], ["S", "R", "15 SEP < 17 SEP"], ["L", "R", ""], ["R", "V", "∴"],
];

export function ProofGraph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 580" className={className} role="img" aria-label="Proof graph for case BK-CS125943: a listed party still controlled the payer when it paid, so the case escalates.">
      <defs>
        <pattern id="pg-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#ffffff" strokeOpacity=".035" strokeWidth="1" /></pattern>
      </defs>
      <rect width="1000" height="580" fill="url(#pg-grid)" />
      {edges.map(([a, b, l], i) => {
        const A = at(a), B = at(b);
        // orthogonal routing: horizontal then vertical, like a schematic
        const d = A.y === B.y || A.x === B.x ? `M${A.x} ${A.y}L${B.x} ${B.y}` : `M${A.x} ${A.y}V${B.y}H${B.x}`;
        const mx = A.x === B.x ? A.x + 10 : (A.x + B.x) / 2, my = A.x === B.x ? (A.y + B.y) / 2 : A.y === B.y ? A.y - 10 : B.y - 10;
        return (
          <g key={i}>
            <path d={d} pathLength={1} className="draw" style={{ animationDelay: `${0.4 + i * 0.35}s` }} fill="none" stroke={b === "V" ? "#c98b8b" : "#ffffff"} strokeOpacity={b === "V" ? 0.9 : 0.45} strokeWidth="1" />
            {l && <text x={mx} y={my} textAnchor={A.x === B.x ? "start" : "middle"} className="appear fill-[#8a8a8a] font-mono" style={{ animationDelay: `${1.2 + i * 0.35}s` }} fontSize="9.5" letterSpacing="1.2">{l}</text>}
          </g>
        );
      })}
      {nodes.map((n, i) => (
        <g key={n.id} className="appear" style={{ animationDelay: `${0.2 + i * 0.3}s` }}>
          <rect x={n.x - 4} y={n.y - 4} width="8" height="8" fill={n.hot ? "#c98b8b" : "#050505"} stroke={n.hot ? "#c98b8b" : "#f2f2f2"} strokeWidth="1" />
          <text x={n.x + 12} y={n.y + 22} className="fill-[#8a8a8a] font-mono" fontSize="9.5" letterSpacing="1.4">{n.k}</text>
          <text x={n.x + 12} y={n.y + 38} className="font-mono" fill={n.hot ? "#e3b1b1" : "#f2f2f2"} fontSize="12.5" letterSpacing=".6">{n.t}</text>
          {n.s && <text x={n.x + 12} y={n.y + 54} className="fill-[#8a8a8a] font-mono" fontSize="10.5" letterSpacing=".6">{n.s}</text>}
        </g>
      ))}
    </svg>
  );
}
