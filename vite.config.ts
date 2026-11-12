import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";

// Each build gets an id; it is baked into the app and written to /version.json, so a running app
// can tell when a newer version has been published (see src/lib/appUpdate.ts).
const BUILD_ID = new Date().toISOString();
// The version shown at the bottom of Settings: package.json's version plus a build number from the
// build time (e.g. 2611121039 = 2026-11-12 10:39 UTC), so every release has its own number.
const APP_VERSION: string = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __SOOZ_BUILD__: JSON.stringify(BUILD_ID),
    __SOOZ_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    {
      name: "sooz-version-file",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
    VitePWA({
      registerType: "prompt", // a new version waits until the user taps "Update now"
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: false,
      strategies: "generateSW",
      filename: "sw.js",
      workbox: {
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // The built-in TikTok library is only a fallback (the app reads the live copy), and it changes
        // daily: don't make every phone download it with each update.
        globIgnores: ["**/christianTikTokLibrary-*.js"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "sooz-pages", networkTimeoutSeconds: 3 },
          },
          {
            // Feed, profiles, chats: fresh when online, last copy when offline
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "sooz-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "sooz-images",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:mp4|webm|mov)(\?.*)?$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "sooz-videos",
              rangeRequests: true,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "sooz-fonts", expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app updates don't make returning users re-download libraries.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return "vendor-react";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (/framer-motion|motion-dom|motion-utils/.test(id)) return "vendor-motion";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui") || id.includes("@floating-ui")) return "vendor-radix";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
