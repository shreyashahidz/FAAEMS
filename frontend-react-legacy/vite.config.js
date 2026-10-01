import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Docker Desktop's bind mount of a Windows host directory doesn't
    // propagate inotify events into the Linux container reliably, so HMR
    // needs polling to actually see file edits.
    watch: { usePolling: true, interval: 300 },
  },
});
