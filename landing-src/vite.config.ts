import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Builds straight into ../viewer as landing.html + landing-assets/*. Never empties viewer/.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      // Classic deferred script (IIFE) so landing.html also opens from file:// (module scripts are blocked there).
      name: "classic-script",
      enforce: "post",
      transformIndexHtml(html) {
        return html.replace(/<script type="module" crossorigin/g, "<script defer").replace(/ crossorigin(?=[ >])/g, "");
      },
    },
  ],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: resolve(__dirname, "../viewer"),
    emptyOutDir: false,
    assetsDir: "landing-assets",
    rollupOptions: { input: resolve(__dirname, "landing.html"), output: { format: "iife" } },
  },
});
