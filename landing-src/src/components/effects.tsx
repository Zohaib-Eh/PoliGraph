// Small hand-ported Aceternity-style effects, restrained for a dark, Linear/Vercel-like look.
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { motion, useInView, useMotionValue, useSpring, useReducedMotion, useMotionTemplate } from "motion/react";
import { cn } from "@/lib/utils";

/** Fine grid that fades out radially (hero background). */
export function GridBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
    </div>
  );
}

/** Soft top spotlight (Aceternity "Spotlight", simplified to a static gradient that fades in). */
export function Spotlight() {
  return (
    <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}
      className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,#7eb6ff2e,#7eb6ff08_55%,transparent)] blur-2xl" />
  );
}

/** Fade + rise on first scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0, 0, 1] }}>
      {children}
    </motion.div>
  );
}

/** Animated number (Aceternity/Magic UI "NumberTicker"). Renders the final value for no-JS/reduced motion. */
export function NumberTicker({ value, decimals = 0, prefix = "", suffix = "", className }:
  { value: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const mv = useMotionValue(reduce ? value : 0);
  const spring = useSpring(mv, { damping: 40, stiffness: 120 });
  const fmt = (n: number) => prefix + n.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  const [text, setText] = useState(fmt(reduce ? value : 0));
  useEffect(() => { if (inView) mv.set(value); }, [inView, mv, value]);
  useEffect(() => spring.on("change", (v) => setText(fmt(v))), [spring]); // eslint-disable-line
  return <span ref={ref} className={cn("tabular-nums", className)}>{text}</span>;
}

/** Card with a cursor-following spotlight border (Aceternity "card spotlight", subtle). */
export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const x = useMotionValue(-200), y = useMotionValue(-200);
  const bg = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, #7eb6ff1a, transparent 70%)`;
  return (
    <div onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set(e.clientX - r.left); y.set(e.clientY - r.top); }}
      onMouseLeave={() => { x.set(-200); y.set(-200); }}
      className={cn("group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-white/20", className)}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** Thin gradient line with a travelling highlight (Aceternity "animated beam", CSS-only). */
export function Beam({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden", vertical ? "h-8 w-px" : "h-px w-full", className)}>
      <div className={cn("absolute inset-0", vertical ? "bg-gradient-to-b" : "bg-gradient-to-r", "from-white/5 via-white/15 to-white/5")} />
      <div className={cn("absolute", vertical ? "inset-x-0 h-1/2 bg-gradient-to-b" : "inset-y-0 w-1/2 bg-gradient-to-r", "from-transparent via-[#7eb6ff] to-transparent animate-shimmer")}
        style={{ backgroundSize: vertical ? "100% 200%" : "200% 100%", [vertical ? "top" : "left"]: 0, [vertical ? "height" : "width"]: "100%" } as CSSProperties} />
    </div>
  );
}
