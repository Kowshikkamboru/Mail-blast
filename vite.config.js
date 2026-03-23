import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "Mail Blast",
        short_name: "MailBlast",
        description: "Job Application Email Automation",
        theme_color: "#0a0c10",
        background_color: "#0a0c10",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
