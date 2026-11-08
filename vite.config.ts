import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("./demo", import.meta.url));

const playgroundRedirect: Plugin = {
  name: "playground-trailing-slash",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/playground") {
        res.statusCode = 302;
        res.setHeader("Location", "/playground/");
        res.end();
        return;
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/playground") {
        res.statusCode = 302;
        res.setHeader("Location", "/playground/");
        res.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  root: "demo",
  base: process.env.VITE_BASE_PATH || "/",
  publicDir: "public",
  appType: "mpa",
  plugins: [playgroundRedirect],
  resolve: {
    alias: [
      {
        find: /^rtl-text-transform\/react$/,
        replacement: fileURLToPath(new URL("./src/react.tsx", import.meta.url)),
      },
      {
        find: /^rtl-text-transform$/,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: {
        landing: resolve(root, "index.html"),
        playground: resolve(root, "playground/index.html"),
      },
    },
  },
  server: {
    port: 5173,
  },
});
