/**
 * Offline PDF fallback: renders the challan sheet on-device with pdf-lib using
 * the SAME shared template as the server, and downloads/saves the file.
 * Download strategy is server-first — this renderer only kicks in when the
 * server PDF can't be fetched.
 *
 * Inter (OFL) is fetched from locally bundled assets — no CDN, no system
 * fallback — so offline prints are byte-identical to the server's.
 */

import type { SheetCompany, SheetDetail } from "../../shared/pdf-template";
import { renderSheetPdf } from "../../shared/pdf-driver";
import interBoldUrl from "../../shared/fonts/Inter-Bold.ttf?url";
import interRegularUrl from "../../shared/fonts/Inter-Regular.ttf?url";
import { API_BASE, deviceHeaders } from "@/lib/api";
import { detectHost, isNative, readNativeToken } from "@/lib/platform";

async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Renders the challan sheet to PDF bytes entirely on-device. */
async function renderChallanPdfLocally(
  detail: SheetDetail,
  company: SheetCompany | null,
  type: "sales" | "outward",
): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await Promise.all([
    fetchFontBytes(interRegularUrl),
    fetchFontBytes(interBoldUrl),
  ]);
  return renderSheetPdf(regularBytes, boldBytes, detail, company, type);
}

function safeFilename(challanNumber: string): string {
  return `challan-${challanNumber.replace(/[^\w.-]/g, "_")}.pdf`;
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function fetchServerPdf(challanId: string): Promise<Blob | null> {
  // Electron loads the renderer from file:// — a direct fetch can never
  // reach the API there, so the main process downloads on our behalf.
  if (detectHost() === "electron" && window.desktop) {
    try {
      const res = await window.desktop.download(`/challans/${challanId}/pdf`);
      if (res.status < 200 || res.status >= 300 || !res.base64) return null;
      return base64ToBlob(res.base64, "application/pdf");
    } catch {
      return null;
    }
  }
  try {
    const token = await readNativeToken();
    const res = await fetch(`${API_BASE}/api/challans/${challanId}/pdf`, {
      credentials: isNative() ? "omit" : "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...deviceHeaders(),
      },
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
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
 * Downloads the challan PDF: server copy when reachable, otherwise rendered
 * on-device from the shared template. Returns which path was used.
 */
export async function downloadChallanPdf(
  challanId: string,
  detail: SheetDetail,
  company: SheetCompany | null,
  type: "sales" | "outward",
): Promise<{ viaServer: boolean }> {
  const filename = safeFilename(detail.challan.challanNumber);
  const serverBlob = await fetchServerPdf(challanId);
  if (serverBlob) {
    await saveBlob(serverBlob, filename);
    return { viaServer: true };
  }
  const bytes = await renderChallanPdfLocally(detail, company, type);
  await saveBlob(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename,
  );
  return { viaServer: false };
}
