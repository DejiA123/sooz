import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: false,
      strategies: "generateSW",
      filename: "sw.js",
      workbox: {
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
