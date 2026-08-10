import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/control-plane": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/api/evidence": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/evidence/, "/api"),
      },
      "/api/fleet": {
        target: "http://127.0.0.1:8789",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fleet/, "/api"),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
