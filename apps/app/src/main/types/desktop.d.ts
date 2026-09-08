import type { DesktopBridge } from "../../../electron/preload";

declare global {
  interface Window {
    /**
     * Present only inside the Electron shell (exposed by electron/preload.ts
     * via contextBridge). Web/PWA never sees this.
     */
    desktop?: DesktopBridge;
  }
}

export {};
