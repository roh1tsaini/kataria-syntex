/**
 * Delivery Challan — shared HTML template and single source of truth for the
 * sheet's markup. One document, three consumers:
 *
 *   - server:  src/server/routes/challans.ts (HTML → PDF via Browser Run)
 *   - desktop: electron/main.ts (HTML → PDF via printToPDF)
 *   - print:   src/main/ui/pages/challans-print.tsx (same sheets in the DOM)
 *
 * All values are entity-escaped and wrapped/shrunk by CSS, so no data length
 * can clip. Inter (OFL) is inlined as base64 @font-face — callers on the
 * server read the TTFs from the ASSETS binding, the renderer fetches the
 * bundled ?url assets; identical bytes everywhere.
 */

import { docCss } from "./challan-css";
import { escapeHtml, buildChallanSheets } from "./challan-sheet";
import type { ChallanHtmlInput } from "./challan-types";

// Re-export all types, constants, and builders for seamless backwards compatibility
export * from "./challan-types";
export * from "./challan-css";
export * from "./challan-sheet";

/** Complete standalone HTML document — the input to both PDF pipelines. */
export function buildChallanHtml(input: ChallanHtmlInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none';">
<title>Challan ${escapeHtml(input.detail.challan.challanNumber)}</title>
<style>${docCss(input.fonts)}</style>
</head>
<body>
${buildChallanSheets(input).body}
</body>
</html>`;
}
