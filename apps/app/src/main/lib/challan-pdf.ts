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
import { ApiError, apiBlob, base64ToBlob } from "@kataria-syntex/app-core";
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

/**
 * Challan PDF for every host — the one place that branches on where it runs.
 * Electron renders the caller's HTML with its own Chromium over the IPC
 * bridge (fully offline); web/PWA fetch the server-rendered copy. `localHtml`
 * is only awaited on the Electron path.
 */
async function challanPdf(
  challanId: string,
  localHtml: () => Promise<string>,
): Promise<{ blob: Blob; via: "local" | "server" }> {
  const desktop = desktopBridge();
  if (desktop) {
    let res: { status: number; base64: string | null };
    try {
      res = await desktop.renderPdf(await localHtml());
    } catch {
      throw networkError();
    }
    if (res.status !== 200 || !res.base64)
      throw new ApiError(res.status || 500, "pdf_render_failed");
    return { blob: base64ToBlob(res.base64, "application/pdf"), via: "local" };
  }
  return { blob: await apiBlob(`/challans/${challanId}/pdf`), via: "server" };
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
 * Downloads the challan PDF (rendered on-device in Electron, fetched from
 * the server everywhere else — decided in challanPdf()) and saves it.
 */
export async function downloadChallanPdf(
  challanId: string,
  detail: SheetDetail,
  company: SheetCompany | null,
  type: ChallanType,
): Promise<{ via: "local" | "server" }> {
  const { blob, via } = await challanPdf(challanId, async () => {
    const fonts = await loadChallanFonts();
    return buildChallanHtml({ detail, company, type, fonts });
  });
  saveBlob(blob, safeFilename(detail.challan.challanNumber));
  return { via };
}
