import { defineConfig } from "vite";
import rollupNodePolyFill from "rollup-plugin-node-polyfills";

export default defineConfig({
  define: {
    global: "window",
    "process.env": {}, // Prevent Vite from replacing it with undefined
  },
  resolve: {
    alias: {
      events: "events/",
      stream: "stream-browserify",
      util: "util/",
      process: "process/browser",
    },
  },
  optimizeDeps: {
    include: ["buffer", "process", "events", "stream", "util"],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,
    watch: {
      usePolling: true,
    },
    allowedHosts: [".ngrok-free.app"],
  },
  build: {
    rollupOptions: {
      // @ts-ignore
      plugins: [rollupNodePolyFill()],
    },
  },
});
