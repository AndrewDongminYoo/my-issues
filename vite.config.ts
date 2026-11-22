import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The page holds a GitHub token in localStorage, so the built page gets a strict CSP.
// Dev mode needs inline scripts and a WebSocket for HMR, so the policy applies to builds only.
const csp = [
  "default-src 'self'",
  "connect-src https://api.github.com",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const contentSecurityPolicy = (): Plugin => ({
  apply: "build",
  name: "content-security-policy",
  transformIndexHtml: () => [
    {
      attrs: { content: csp, "http-equiv": "Content-Security-Policy" },
      injectTo: "head-prepend",
      tag: "meta",
    },
  ],
});

// Dev only: serves the gitignored local/snapshot.json so the board can render without a token.
// It is a server route, not an import, so the file never enters a build.
const localFixture = (): Plugin => ({
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.endsWith("/__fixture/snapshot.json")) return next();
      try {
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(new URL("./local/snapshot.json", import.meta.url)));
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
  },
  name: "local-fixture",
});

export default defineConfig({
  // Served from the root of its own domain (gh.donminzzi.kr), so that no other site shares
  // the origin and its localStorage. Set BASE_PATH=/my-issues/ to serve from <user>.github.io.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), contentSecurityPolicy(), localFixture()],
});
