import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";

// Each build gets an id; it is baked into the app and written to /version.json, so a running app can
// tell when a newer version has been published (see src/lib/appUpdate.ts). It's a fingerprint of the
// app's own files — NOT the build time — so the daily Christian TikTok library refresh (a commit to
// the library JSON that makes the hosts rebuild) doesn't look like an app update: the build comes out
// identical and nobody sees "Updating…". It changes only when the app itself changes.
const LIBRARY_FILE = path.resolve(__dirname, "src/data/christianTikTokLibrary.json");
function sourceFingerprint(): string {
  const hash = createHash("sha256");
  const add = (p: string) => {
    let st;
    try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) {
      for (const name of readdirSync(p).sort()) if (name !== "node_modules" && !name.startsWith(".")) add(path.join(p, name));
    } else if (p !== LIBRARY_FILE) {
      hash.update(path.relative(__dirname, p).split(path.sep).join("/"));
      hash.update(readFileSync(p));
    }
  };
  for (const p of ["src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "tsconfig.json", "tsconfig.app.json"]) add(path.resolve(__dirname, p));
  return hash.digest("hex").slice(0, 12);
}
const BUILD_ID = sourceFingerprint();
// The version shown at the bottom of Settings: package.json's version plus the build code
// (e.g. "v1.0.0 (3f9a1c2)").
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
        // The library copy the app falls back to when GitHub can't be reached: a plain file next to the
        // app (not part of its code), so a library refresh doesn't change the app's code files.
        this.emitFile({ type: "asset", fileName: "christian-library.json", source: readFileSync(LIBRARY_FILE, "utf8") });
      },
      // index.html's opening check compares this copy's build with /version.json.
      transformIndexHtml: { order: "pre", handler: (html: string) => html.replace(/\{\{SOOZ_BUILD\}\}/g, BUILD_ID) },
    },
    {
      // Home is the first screen almost everyone opens: fetch its code together with the app's core
      // instead of after it (it's a separate, lazily loaded piece).
      name: "sooz-preload-home",
      transformIndexHtml: {
        order: "post",
        handler(_html, ctx) {
          if (!ctx.bundle) return;
          const chunks = Object.values(ctx.bundle).filter((c): c is import("rollup").OutputChunk => c.type === "chunk");
          const home = chunks.find((c) => c.facadeModuleId?.endsWith("/src/pages/Index.tsx"));
          if (!home) return;
          const entry = chunks.find((c) => c.isEntry);
          const have = new Set<string>(entry ? [entry.fileName, ...entry.imports] : []);
          const want = new Set<string>();
          const add = (file: string) => {
            if (have.has(file) || want.has(file)) return;
            want.add(file);
            const c = ctx.bundle![file];
            if (c && c.type === "chunk") c.imports.forEach(add);
          };
          add(home.fileName);
          return [...want].map((file) => ({ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `/${file}` }, injectTo: "head" as const }));
        },
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
        // Nor big pictures the app never shows on screen (old logos, install icons).
        globIgnores: ["**/christianTikTokLibrary-*.js", "sooz-logo*.png", "sooz-favicon.png", "icon-*.png", "apple-touch-icon.png"],
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
            // TikTok covers (GitHub "covers" branch): only real pictures are kept (status 200), in their
            // own cache, so a cover that failed once (e.g. while the repo was private) is fetched again.
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/DejiA123\/sooz\/covers\//,
            handler: "CacheFirst",
            options: {
              cacheName: "sooz-covers",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [200] },
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
