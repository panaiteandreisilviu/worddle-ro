import { defineConfig } from "vite";

// Set by `tauri android dev` on a physical device so the phone can reach this Mac
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Listen on all interfaces when the device needs LAN access.
    // Binding only to TAURI_DEV_HOST often makes Tauri's readiness check hang.
    host: host ? "0.0.0.0" : false,
    allowedHosts: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/ro_stardict/**", "**/scripts/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    include: ["tests/**/*.test.js"],
  },
});
