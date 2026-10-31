import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const api = "http://127.0.0.1:8000";

function mpaPaths(): Plugin {
  const pages: Record<string, string> = {
    "/login": "/login.html",
    "/signup": "/signup.html",
    "/viewer": "/viewer.html",
  };
  return {
    name: "mpa-paths",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const q = req.url.indexOf("?");
        const path = q === -1 ? req.url : req.url.slice(0, q);
        const dest = pages[path];
        if (dest) {
          req.url = dest + (q === -1 ? "" : req.url.slice(q));
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mpaPaths()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        viewer: resolve(__dirname, "viewer.html"),
        login: resolve(__dirname, "login.html"),
        signup: resolve(__dirname, "signup.html"),
      },
    },
  },
  server: {
    proxy: {
      "/files": api,
      "/auth": api,
      "/api": api,
      "/health": api,
      "/uploads": api,
    },
  },
});
