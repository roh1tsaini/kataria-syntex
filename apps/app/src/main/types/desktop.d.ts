import type { DesktopBridge } from "../../../electron/preload";

declare global {
  interface Window {
    /**
     * Present only inside the Electron shell (exposed by electron/preload.ts
     * via contextBridge). Web/PWA and Capacitor never see this.
     */
    desktop?: DesktopBridge;
  }
}

export {};
