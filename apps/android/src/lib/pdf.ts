/**
 * Challan PDF on Android — the server renders the PDF (Browser Run);
 * this shell downloads it with the session bearer and hands it to the
 * system: share sheet (save to Drive/WhatsApp/etc.) or the Android print
 * framework (expo-print prints a PDF URI via PrintManager).
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ApiError, apiOrigin, deviceHeaders } from "@kataria-syntex/app-core";
import { core } from "@kataria-syntex/app-core";

export function safeFilename(challanNumber: string): string {
  return `challan-${challanNumber.replace(/[^\w.-]/g, "_")}.pdf`;
}

/** Downloads the server-rendered PDF into the app cache and returns the
 * local file URI. Auth mirrors api(): persisted bearer, device headers. */
export async function fetchChallanPdf(
  challanId: string,
  challanNumber: string,
): Promise<string> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) throw new ApiError(0, "storage_unavailable");
  const dir = `${baseDir}pdfs/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const target = `${dir}${safeFilename(challanNumber)}`;

  const token = await core().readToken();
  let res: Response;
  try {
    res = await fetch(`${apiOrigin()}/api/challans/${challanId}/pdf`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...deviceHeaders(),
      },
    });
  } catch {
    throw new ApiError(0, "network_error");
  }
  if (!res.ok) {
    let code = res.status === 429 ? "rate_limited" : "pdf_render_failed";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") code = body.error;
    } catch {
      // non-JSON error body — keep the status-derived code
    }
    throw new ApiError(res.status, code);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  // Hermes has no btoa and spread of large arrays overflows the stack —
  // encode in small chunks with a manual base64 alphabet instead.
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let binary = "";
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const end = Math.min(i + chunk, bytes.length);
    let chunkBits = "";
    for (let j = i; j < end; j++) {
      chunkBits += String.fromCharCode(bytes[j]);
    }
    binary += chunkBits;
  }
  let base64 = "";
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    const triple = (a << 16) | (b << 8) | c;
    base64 +=
      alphabet[(triple >> 18) & 63] +
      alphabet[(triple >> 12) & 63] +
      (i + 1 < binary.length ? alphabet[(triple >> 6) & 63] : "=") +
      (i + 2 < binary.length ? alphabet[triple & 63] : "=");
  }
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return target;
}

/** Opens the Android share sheet (Save to Files / Drive / WhatsApp …). */
export async function shareChallanPdf(
  challanId: string,
  challanNumber: string,
): Promise<void> {
  const uri = await fetchChallanPdf(challanId, challanNumber);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new ApiError(0, "share_unavailable");
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share challan PDF",
  });
}

/** Prints the PDF through the Android PrintManager (system print dialog). */
export async function printChallanPdf(
  challanId: string,
  challanNumber: string,
): Promise<void> {
  const uri = await fetchChallanPdf(challanId, challanNumber);
  await Print.printAsync({ uri });
}
