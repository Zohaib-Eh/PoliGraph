import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/** Slow fade on first view, CSS-driven (IntersectionObserver adds .in). Visible without JS observer support. */
export function Fade({ children, delay = 0, className = "", as = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setIn] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current; if (!el || inView) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el); return () => io.disconnect();
  }, [inView]);
  const Tag = as as "div";
  return <Tag ref={ref as React.RefObject<HTMLDivElement>} className={`fade ${inView ? "in" : ""} ${className}`} style={{ "--d": `${delay}s` } as CSSProperties}>{children}</Tag>;
}
