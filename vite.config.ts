import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars so we can use them in proxy config (Node.js context)
  const env = loadEnv(mode, process.cwd(), "");
  const serverKey = env.VITE_MIDTRANS_SERVER_KEY;
  const isProduction = env.VITE_MIDTRANS_IS_PRODUCTION === "true";
  const midtransApiBase = isProduction
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  const authBase64 = serverKey
    ? Buffer.from(serverKey + ":").toString("base64")
    : "";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/midtrans-charge": {
          target: midtransApiBase,
          changeOrigin: true,
          rewrite: () => "/v2/charge",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-snap": {
          target: isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com",
          changeOrigin: true,
          rewrite: () => "/snap/v1/transactions",
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-status": {
          target: midtransApiBase,
          changeOrigin: true,
          rewrite: (reqPath) => {
            const match = reqPath.match(/orderId=([^&]+)/);
            const orderId = match ? decodeURIComponent(match[1]) : "";
            return `/v2/${orderId}/status`;
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
            });
          },
        },
        "/api/midtrans": {
          target: "https://app.sandbox.midtrans.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/midtrans/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/midtrans-prod": {
          target: "https://app.midtrans.com",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/midtrans-prod/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (authBase64) {
                proxyReq.setHeader("Authorization", `Basic ${authBase64}`);
              }
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
      },
    },
    plugins: [
      nodePolyfills(),
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      force: false,
    },
    build: {
      sourcemap: mode !== 'production',
      target: 'es2020',
      chunkSizeWarningLimit: 3000,
      // Drop console logs & debugger statements in production build
      ...(mode === 'production' && {
        minify: 'esbuild',
        esbuildOptions: {
          drop: ['console', 'debugger'],
        },
      }),
      rollupOptions: {
        // Explicitly mark unused packages as external to prevent bundling
        // (firebase-admin is server-only and should never be bundled)
        external: [
          'firebase-admin',
        ],
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
        output: {
          // Manual chunk splitting untuk performa optimal di Capacitor WebView
          manualChunks: (id) => {
            // Firebase ke chunk sendiri (hanya firebase client SDK, bukan firebase-admin)
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
            // Recharts (besar) ke chunk sendiri
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'charts';
            // Radix UI ke chunk sendiri
            if (id.includes('@radix-ui')) return 'radix';
            // DnD kit
            if (id.includes('@dnd-kit')) return 'dnd';
            // React core
            if (id.includes('react-dom') || id.includes('react-router')) return 'react';
            // Barcode / QR / print libs
            if (id.includes('qrcode') || id.includes('react-barcode') || id.includes('html2canvas') || id.includes('html-to-image') || id.includes('html5-qrcode') || id.includes('jsqr')) return 'print-utils';
            // Capacitor core + plugins ke chunk tersendiri (di-import dinamis)
            if (id.includes('@capacitor/') || id.includes('@capawesome/') || id.includes('@capacitor-mlkit') || id.includes('@capacitor-community') || id.includes('@hugotomazi')) return 'capacitor-plugins';
            // XLSX / export
            if (id.includes('xlsx')) return 'export-utils';
          },
        },
      },
    },
  };
});
