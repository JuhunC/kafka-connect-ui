import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same-origin app. In dev, proxy /api to the backend so the browser only
// ever talks to the Vite origin (mirrors the nginx reverse proxy in prod).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libs so the main bundle stays reasonable.
        manualChunks: {
          mui: ["@mui/material", "@mui/icons-material"],
          datagrid: ["@mui/x-data-grid"],
          flow: ["@xyflow/react"],
          query: ["@tanstack/react-query"],
          oidc: ["oidc-client-ts", "react-oidc-context"],
        },
      },
    },
  },
});
