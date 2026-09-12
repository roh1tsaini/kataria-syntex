/**
 * Challan PDF — client-side glue around the shared template: loads the
 * bundled Inter TTFs, builds the HTML for the local render, and saves the
 * finished file. The host transport lives here: Electron renders with its
 * own Chromium over the IPC bridge (fully offline); web/PWA fetches the
 * server-rendered copy. Inter (OFL) is fetched from locally bundled assets
 * — no CDN, no system fallback. (The Android app downloads the server PDF
 * through its own shell — apps/android/lib/pdf.ts.)
 */

import type { ChallanFonts } from "../../shared/challan-html";
import {
  buildChallanHtml,
  type ChallanType,
  type SheetCompany,
  type SheetDetail,
} from "../../shared/challan-html";
import { bytesToBase64 } from "../../shared/base64";
import { createCached } from "../../shared/cached";
import interBoldUrl from "../../shared/fonts/Inter-Bold.ttf?url";
import interRegularUrl from "../../shared/fonts/Inter-Regular.ttf?url";
import { ApiError, apiBlob } from "@kataria-syntex/app-core";
import { desktopBridge } from "@/lib/platform";

/** Both Inter weights as base64 for the template's inline @font-face. */
export const loadChallanFonts: () => Promise<ChallanFonts> = createCached(
  async () => {
    const toBase64 = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
      return bytesToBase64(new Uint8Array(await res.arrayBuffer()));
    };
    const [regular, bold] = await Promise.all([
      toBase64(interRegularUrl),
      toBase64(interBoldUrl),
    ]);
    return { regular, bold };
  },
);

function safeFilename(challanNumber: string): string {
  return `challan-${challanNumber.replace(/[^\w.-]/g, "_")}.pdf`;
}

/** Network-level failure (server unreachable) → ApiError(0, "network_error"). */
function networkError(): ApiError {
  return new ApiError(0, "network_error");
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Downloads the challan PDF — the one place that branches on where it runs.
 * Electron renders the sheet with its own Chromium (fully offline) and writes
 * it through a native save dialog; web/PWA fetch the server-rendered copy and
 * hand it to the browser's downloader.
 *
 * `saved` is false only when the user dismissed the desktop save dialog.
 */
export async function downloadChallanPdf(
  challanId: string,
  detail: SheetDetail,
  company: SheetCompany | null,
  type: ChallanType,
): Promise<{ via: "local" | "server"; saved: boolean }> {
  const filename = safeFilename(detail.challan.challanNumber);
  const desktop = desktopBridge();
  if (desktop) {
    const fonts = await loadChallanFonts();
    const html = buildChallanHtml({ detail, company, type, fonts });
    let res: { status: number; base64: string | null };
    try {
      res = await desktop.renderPdf(html);
    } catch {
      throw networkError();
    }
    if (res.status !== 200 || !res.base64)
      throw new ApiError(res.status || 500, "pdf_render_failed");
    const { saved } = await desktop.saveFile(res.base64, filename);
    return { via: "local", saved };
  }
  saveBlob(await apiBlob(`/challans/${challanId}/pdf`), filename);
  return { via: "server", saved: true };
}
