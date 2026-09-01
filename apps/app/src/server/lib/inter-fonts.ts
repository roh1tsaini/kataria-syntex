/**
 * Inter font bytes for the server PDF renderer. Pages Functions can't bundle
 * .ttf imports, so the fonts ship as static assets (dist/fonts, copied by the
 * vite build) and are read through the ASSETS binding. Fetched once per
 * isolate and cached — both weights are needed for every PDF.
 */
export type InterFonts = { regular: Uint8Array; bold: Uint8Array };

const FILES = {
  regular: "/fonts/Inter-Regular.ttf",
  bold: "/fonts/Inter-Bold.ttf",
} as const;

let cache: Promise<InterFonts> | null = null;

// baseUrl: any absolute URL from the incoming request — the local dev assets
// fetcher rejects relative paths ("Invalid URL"), prod accepts both.
export function loadInterFonts(
  assets: Fetcher,
  baseUrl: string,
): Promise<InterFonts> {
  cache ??= (async () => {
    const [regularRes, boldRes] = await Promise.all([
      assets.fetch(new URL(FILES.regular, baseUrl)),
      assets.fetch(new URL(FILES.bold, baseUrl)),
    ]);
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error("Inter fonts missing from static assets");
    }
    return {
      regular: new Uint8Array(await regularRes.arrayBuffer()),
      bold: new Uint8Array(await boldRes.arrayBuffer()),
    };
  })().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
