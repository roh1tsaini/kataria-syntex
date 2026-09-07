/**
 * Inter font bytes for the PDF renderer. Workers can't bundle .ttf imports,
 * so the fonts ship as static assets (dist/fonts, copied by the vite build),
 * are read through the ASSETS binding, and are handed to the challan template
 * as base64 for its inline @font-face. Fetched once per isolate and cached —
 * both weights are needed for every PDF.
 */
import type { ChallanFonts } from "../../shared/challan-html";
import { bytesToBase64 } from "../../shared/base64";

const FILES = {
  regular: "/fonts/Inter-Regular.ttf",
  bold: "/fonts/Inter-Bold.ttf",
} as const;

let cache: Promise<ChallanFonts> | null = null;

// baseUrl: any absolute URL from the incoming request — the local dev assets
// fetcher rejects relative paths ("Invalid URL"), prod accepts both.
export function loadInterFonts(
  assets: Fetcher,
  baseUrl: string,
): Promise<ChallanFonts> {
  cache ??= (async () => {
    const [regularRes, boldRes] = await Promise.all([
      assets.fetch(new URL(FILES.regular, baseUrl)),
      assets.fetch(new URL(FILES.bold, baseUrl)),
    ]);
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error("Inter fonts missing from static assets");
    }
    return {
      regular: bytesToBase64(new Uint8Array(await regularRes.arrayBuffer())),
      bold: bytesToBase64(new Uint8Array(await boldRes.arrayBuffer())),
    };
  })().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
