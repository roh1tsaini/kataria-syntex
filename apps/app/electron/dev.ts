/**
 * Electron dev orchestrator: starts the Vite dev server, waits for it to
 * answer on :1420, then launches Electron with KC_DEV=1. Ctrl+C / exit
 * tears both down.
 */
import { spawn, type ChildProcess } from "node:child_process";

const vite = spawn("bunx", ["vite", "--port", "1420", "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});

let electron: ChildProcess | null = null;
let exited = false;
const shutdown = (code: number) => {
  if (exited) return;
  exited = true;
  vite.kill();
  electron?.kill();
  process.exit(code);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForVite(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://localhost:1420");
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await wait(500);
  }
  return false;
}

vite.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
vite.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
vite.on("exit", (code) => shutdown(code ?? 0));

if (!(await waitForVite())) {
  console.error("vite dev server did not come up on :1420");
  shutdown(1);
}

electron = spawn("bunx", ["electron", "."], {
  stdio: "inherit",
  env: { ...process.env, KC_DEV: "1" },
  shell: process.platform === "win32",
});

electron.on("exit", (code) => shutdown(code ?? 0));

process.on("SIGINT", () => shutdown(0));
