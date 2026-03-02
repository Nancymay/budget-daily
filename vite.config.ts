import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/budget-daily/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/icon.svg", "icons/icon-maskable.svg"],
        manifest: {
          name: "Budget Daily",
          short_name: "BudgetDaily",
          description: "Offline-first budget planner with daily balance forecast",
          theme_color: "#0f1218",
          background_color: "#0f1218",
          display: "standalone",
          start_url: ".",
          icons: [
            {
              src: "icons/icon.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any"
            },
            {
              src: "icons/icon-maskable.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "maskable"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          cleanupOutdatedCaches: true
        }
      })
    ]
  };
});
