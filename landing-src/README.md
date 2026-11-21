# PoliGraph landing page (source)

Vite + React + TypeScript + Tailwind v4, shadcn/ui-style components (`src/components/ui`), Motion (framer-motion) and lucide-react.
Aceternity-style effects are hand-ported in `src/components/effects.tsx` (grid background, spotlight, reveal, number ticker, spotlight card, beam).

    npm ci
    npm run build    # writes ../viewer/landing.html and ../viewer/landing-assets/*

The build is a single deferred IIFE script (no ES modules), so `viewer/landing.html` also opens from file://.
Fonts (Inter, Geist Mono) are bundled via @fontsource; no CDN. Respects prefers-reduced-motion.
