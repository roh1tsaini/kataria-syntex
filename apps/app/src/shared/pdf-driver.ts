/**
 * pdf-lib driver for the shared challan template — the ONE adapter that
 * translates the template's top-left baseline geometry into pdf-lib's
 * bottom-left origin. Both renderers consume it so online and offline
 * prints can never drift:
 *
 *   - server: src/server/routes/challans.ts (fonts via ASSETS binding)
 *   - client: src/main/lib/offline-pdf.ts  (fonts bundled as ?url assets)
 *
 * Only the font source differs; everything visual lives here and in
 * pdf-template.ts.
 */
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  SHEET_H,
  SHEET_W,
  drawChallanSheet,
  paginateItems,
  type SheetCompany,
  type SheetDetail,
} from "./pdf-template";

/** Inter's cap-height ÷ em; fallback keeps layout sane if introspection fails. */
const INTER_CAP_RATIO = 0.72754;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function capRatioOf(font: PDFFont): number {
  const inner = (
    font as unknown as {
      font?: { font?: { capHeight?: number; unitsPerEm?: number } };
    }
  ).font?.font;
  return inner?.capHeight && inner?.unitsPerEm
    ? inner.capHeight / inner.unitsPerEm
    : INTER_CAP_RATIO;
}

/** SVG path for a fully-rounded (pill) rectangle in y-down coordinates. */
function pillPath(w: number, h: number): string {
  const r = h / 2;
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

/**
 * Renders the challan sheet to PDF bytes. Callers supply Inter font bytes
 * from their platform's source; registration, embedding, pagination and
 * drawing are identical everywhere.
 */
export async function renderSheetPdf(
  regular: Uint8Array,
  bold: Uint8Array,
  detail: SheetDetail,
  company: SheetCompany | null,
  type: "sales" | "outward",
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const normal = await pdf.embedFont(regular);
  const boldFont = await pdf.embedFont(bold);
  const capRatio = capRatioOf(normal);
  let page: PDFPage | null = null;

  // pdf-lib's origin is bottom-left and drawText y IS the baseline; the
  // shared template speaks top-left baselines, so only a single flip is
  // needed.
  const flip = (y: number) => SHEET_H - y;

  const doc = {
    addPage: () => {
      page = pdf.addPage([SHEET_W, SHEET_H]);
    },
    text: (
      value: string,
      x: number,
      y: number,
      size: number,
      isBold: boolean,
      opts?: {
        width?: number;
        align?: "left" | "center" | "right";
        color?: string;
      },
    ) => {
      if (!page || !value) return;
      const width = opts?.width ?? SHEET_W - x;
      const font: PDFFont = isBold ? boldFont : normal;
      const align = opts?.align ?? "left";
      // pdf-lib has no align option — position manually within the width box.
      const textW = Math.min(font.widthOfTextAtSize(value, size), width);
      const tx =
        align === "center"
          ? x + (width - textW) / 2
          : align === "right"
            ? x + width - textW
            : x;
      page.drawText(value, {
        x: tx,
        y: flip(y),
        size,
        font,
        color: hexToRgb(opts?.color ?? "#000000"),
      });
    },
    rect: (x: number, y: number, w: number, h: number, color = "#000000") => {
      if (!page) return;
      page.drawRectangle({
        x,
        y: flip(y + h),
        width: w,
        height: h,
        borderColor: hexToRgb(color),
        borderWidth: 0.6,
      });
    },
    pill: (
      x: number,
      y: number,
      w: number,
      h: number,
      opts: { border?: string; fill?: string },
    ) => {
      if (!page) return;
      page.drawSvgPath(pillPath(w, h), {
        x,
        y: flip(y),
        borderColor: opts.border ? hexToRgb(opts.border) : undefined,
        borderWidth: opts.border ? 0.6 : 0,
        color: opts.fill ? hexToRgb(opts.fill) : undefined,
      });
    },
    fillRect: (
      x: number,
      y: number,
      w: number,
      h: number,
      color = "#000000",
    ) => {
      if (!page) return;
      page.drawRectangle({
        x,
        y: flip(y + h),
        width: w,
        height: h,
        color: hexToRgb(color),
      });
    },
    line: (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      width = 0.6,
      color = "#000000",
    ) => {
      if (!page) return;
      page.drawLine({
        start: { x: x1, y: flip(y1) },
        end: { x: x2, y: flip(y2) },
        thickness: width,
        color: hexToRgb(color),
      });
    },
    widthOf: (value: string, size: number, isBold = false) =>
      (isBold ? boldFont : normal).widthOfTextAtSize(value, size),
    capRatio: () => capRatio,
  };

  const pages = paginateItems(detail.items);
  pages.forEach((items, i) => {
    doc.addPage();
    drawChallanSheet(doc, detail, company, type, items, i, pages.length);
  });

  return pdf.save();
}
