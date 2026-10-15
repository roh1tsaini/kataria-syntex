/**
 * Serves the exported web bundle (dist/) for Playwright.
 *
 * Expo Router's static export writes one HTML file per route, so this server
 * maps a pathname to its file, then to <path>.html, then to <path>/index.html,
 * and finally falls back to index.html for client-side routing — the same
 * behaviour the deployed app gets from its Worker.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8081);

function fileFor(pathname: string): string | null {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidates = [
    resolve(DIST, clean),
    resolve(DIST, `${clean}.html`),
    resolve(DIST, clean, "index.html"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

Bun.serve({
  port: PORT,
  fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "index.html" : url.pathname;
    const file = fileFor(pathname);
    if (file) return new Response(Bun.file(file));
    const fallback = resolve(DIST, "index.html");
    if (existsSync(fallback)) return new Response(Bun.file(fallback));
    return new Response("Not found", { status: 404 });
  },
});

console.log(`serving ${DIST} on http://localhost:${PORT}`);
