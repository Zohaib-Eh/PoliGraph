# PoliGraph landing page (source)

Vite + React 19 + TypeScript + Tailwind v4. Editorial, monochrome design (Anduril / SpaceX-inspired).
Fonts bundled locally via @fontsource: Archivo (variable width, used expanded for display), Inter, Geist Mono. No CDN.
Motion is CSS-only (slow fades + SVG line-draw), switched off under prefers-reduced-motion.

    npm ci
    npm run build    # writes ../viewer/landing.html and ../viewer/landing-assets/*

The build is one deferred IIFE script (no ES modules), so viewer/landing.html also opens from file://.
The hero graph (src/components/ProofGraph.tsx) is case BK-CS125943 from output/bank.jsonl.
