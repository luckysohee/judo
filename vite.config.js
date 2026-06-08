import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/pages/Studio/") ||
            id.includes("\\pages\\Studio\\")
          ) {
            return "studio";
          }
          if (!id.includes("node_modules")) return;
          if (id.includes("heic2any")) return "vendor-heic";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    cors: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/recommend": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
})
