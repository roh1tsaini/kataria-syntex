/**
 * Challan PDF — client-side glue around the shared template: loads the
 * bundled Inter TTFs, builds the HTML for the local render, and saves the
 * finished file. The host transport (Electron printToPDF vs server Browser
 * Run fetch) lives in api.ts's challanPdf(). Inter (OFL) is fetched from
 * locally bundled assets — no CDN, no system fallback.
 */

import type { ChallanFonts } from "../../shared/challan-html";
import {
  buildChallanHtml,
  type ChallanType,
  type SheetCompany,
  type SheetDetail,
} from "../../shared/challan-html";
import { bytesToBase64 } from "../../shared/base64";
import interBoldUrl from "../../shared/fonts/Inter-Bold.ttf?url";
import interRegularUrl from "../../shared/fonts/Inter-Regular.ttf?url";
import { challanPdf } from "@/lib/api";
import { isNative } from "@/lib/platform";

let fontsCache: Promise<ChallanFonts> | null = null;

/** Both Inter weights as base64 for the template's inline @font-face. */
export function loadChallanFonts(): Promise<ChallanFonts> {
  fontsCache ??= (async () => {
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
  })().catch((e) => {
    fontsCache = null;
    throw e;
  });
  return fontsCache;
}

function safeFilename(challanNumber: string): string {
  return `challan-${challanNumber.replace(/[^\w.-]/g, "_")}.pdf`;
}

async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const base64 = await blobToBase64(blob);
      const saved = await Filesystem.writeFile({
        path: filename,
        directory: Directory.Documents,
        data: base64,
      });
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: filename,
        url: saved.uri,
        dialogTitle: "Save or share challan PDF",
      });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads the challan PDF (rendered on-device in Electron, fetched from the
 * server everywhere else — decided inside api.ts) and saves/shares it.
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
  await saveBlob(blob, safeFilename(detail.challan.challanNumber));
  return { via };
}
