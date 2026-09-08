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
  const dir = `${FileSystem.documentDirectory}pdfs/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {},
  );
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
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  await FileSystem.writeAsStringAsync(target, btoa(binary), {
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
