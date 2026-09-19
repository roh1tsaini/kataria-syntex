import {
  CHALLAN_SHEET_WIDTH_MM,
  CHALLAN_SHEET_HEIGHT_MM,
} from "@kataria-syntex/shared";
import type { ChallanFonts } from "./challan-types";

export const SHEET_W_MM = CHALLAN_SHEET_WIDTH_MM;
export const SHEET_H_MM = CHALLAN_SHEET_HEIGHT_MM;

/**
 * Print-exact stylesheet. The sheet is a fixed A5-landscape box; every zone
 * is a grid row so no dynamic value can push later zones off the page.
 */
export function sheetCss(): string {
  return `
:root { --ink:#000; --label:#52525b; --faint:#a1a1aa; --rule:#e4e4e7; --head:#3f3f46; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { background:#fff; }
body { font-family:"Inter Print", Inter, sans-serif; color:var(--ink);
  font-feature-settings:"tnum" 1, "lnum" 1; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.sheet { width:${SHEET_W_MM}mm; height:${SHEET_H_MM}mm; background:#fff;
  padding:4mm 6mm 2.8mm; display:flex; flex-direction:column; overflow:hidden;
  page-break-after:always; break-after:page; }
.sheet:last-child { page-break-after:auto; break-after:auto; }

/* ── Masthead ── */
.masthead { display:grid; grid-template-columns:34mm 1fr 30mm; align-items:center; }
.doc-title { font-size:8.5pt; font-weight:700; line-height:1.35; letter-spacing:.02em; }
.company { text-align:center; min-width:0; }
.company-name { font-size:17pt; font-weight:800; letter-spacing:.04em; line-height:1.1;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.company-sub { font-size:6.6pt; color:var(--label); line-height:1.5;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.copies { justify-self:end; display:flex; flex-direction:column; gap:1.4mm; }
.copy { display:flex; align-items:center; gap:1.6mm; font-size:6.4pt; font-weight:600;
  color:var(--head); letter-spacing:.02em; }
.copy::before { content:""; width:3.2mm; height:3.2mm; border:.35mm solid var(--ink); border-radius:.5mm; background:#fff; }
.masthead-rule { border:none; border-top:.55mm solid var(--ink); margin:1.8mm 0 0; }

/* ── Party band ── */
.party { display:grid; grid-template-columns:1fr 52mm; border:.35mm solid var(--ink);
  border-top:none; }
.party-main { padding:2mm 3mm 1.8mm; min-width:0; }
.party-line { display:flex; align-items:baseline; gap:2mm; min-width:0; }
.party-ms { font-size:6.4pt; font-weight:700; color:var(--head); flex:none; }
.party-name { font-size:10.5pt; font-weight:700; letter-spacing:.015em; min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.party-gstin { margin-left:auto; font-size:7pt; font-weight:700; color:var(--head);
  white-space:nowrap; }
.party-sub { display:flex; gap:3mm; margin-top:1.1mm; font-size:6.6pt; color:var(--label);
  white-space:nowrap; overflow:hidden; }
.party-sub span { overflow:hidden; text-overflow:ellipsis; }
.party-meta { border-left:.35mm solid var(--ink); padding:2mm 3mm; display:flex;
  flex-direction:column; justify-content:center; gap:1.2mm; min-width:0; }
.meta-row { display:flex; align-items:baseline; gap:2mm; }
.meta-label { font-size:6.2pt; font-weight:700; color:var(--label);
  letter-spacing:.04em; flex:none; }
.meta-value { font-size:11pt; font-weight:800; margin-left:auto; min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.meta-row:last-child .meta-value { font-size:9.5pt; font-weight:700; }

/* ── Items table ── */
table.items { width:100%; border-collapse:collapse; table-layout:fixed; }
.items th { background:var(--ink); color:#fff; font-size:6.7pt; font-weight:700;
  letter-spacing:.05em; padding:1.3mm 1.6mm; text-align:center; }
.items td { font-size:7.8pt; padding:0 1.6mm; text-align:center; height:5.25mm;
  line-height:5.25mm; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.items tbody tr { border-bottom:.18mm solid var(--rule); }
.items tbody tr:last-child { border-bottom:.3mm solid var(--ink); }
.items { border:.3mm solid var(--ink); border-top:none; }

/* ── Totals ── */
.totals { display:grid; grid-template-columns:1fr 58mm; gap:4mm; margin-top:1.6mm;
  padding:0 .4mm; }
.totals-left { min-width:0; align-self:center; }
.stat-line { font-size:7.4pt; font-weight:700; line-height:1.65; min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.stat-line .lbl { color:var(--label); font-weight:600; }
.remarks-line { font-size:7.4pt; line-height:1.65; color:var(--label); margin-top:.8mm;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.remarks-line b { color:var(--ink); }
.totals-right { display:flex; flex-direction:column; justify-content:center; }
.tot-row { display:flex; align-items:baseline; font-size:7.4pt; line-height:1.5; }
.tot-row .lbl { color:var(--label); }
.tot-row .val { margin-left:auto; font-weight:700; padding-left:3mm; }
.tot-rule { border:none; border-top:.25mm solid var(--rule); margin:.3mm 0; }
.tot-row.final { font-weight:700; }
.tot-row.final .lbl { color:var(--ink); }
.tot-row.final .val { font-size:8.6pt; }

/* ── Footer ── */
.foot-rule { border:none; border-top:.3mm solid var(--ink); margin:1.6mm 0 0; }
.footer { display:grid; grid-template-columns:64mm 1fr 62mm; gap:4mm;
  padding:1.3mm .4mm 0; flex:1; min-height:0; }
.terms h3 { font-size:7.2pt; font-weight:700; letter-spacing:.02em; }
.terms ol { margin:.8mm 0 0 3.4mm; font-size:6.6pt; color:var(--label); line-height:1.5; }
.sign-cell { display:flex; flex-direction:column; align-items:center;
  justify-content:flex-end; gap:1mm; }
.sign-line { width:34mm; border-top:.25mm solid var(--faint); }
.sign-cap { font-size:6.4pt; color:var(--label); }
.auth-cell { display:flex; flex-direction:column; align-items:flex-end;
  justify-content:flex-end; gap:1mm; text-align:right; }
.auth-for { font-size:8.6pt; font-weight:800; letter-spacing:.02em; max-width:100%;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.auth-line { width:34mm; border-top:.25mm solid var(--faint); }
.auth-cap { font-size:6pt; font-weight:600; color:var(--label); letter-spacing:.06em; }
.page-no { text-align:center; font-size:6.2pt; color:var(--faint); margin-top:1mm; }
`;
}

/**
 * Inline @font-face for both Inter weights — "Inter Print" must be registered
 * in EVERY surface's stylesheet (PDF documents and the print page alike), or
 * that surface silently typesets in a system font.
 */
export function fontFaceCss(fonts: ChallanFonts): string {
  return `
@font-face { font-family:"Inter Print"; font-weight:400; font-style:normal;
  src:url(data:font/ttf;base64,${fonts.regular}) format("truetype"); }
@font-face { font-family:"Inter Print"; font-weight:700; font-style:normal;
  src:url(data:font/ttf;base64,${fonts.bold}) format("truetype"); }`;
}

/** Full-document CSS: fonts inlined so every renderer typesets identical glyphs. */
export function docCss(fonts: ChallanFonts): string {
  return `
${fontFaceCss(fonts)}
@page { size:${SHEET_W_MM}mm ${SHEET_H_MM}mm; margin:0; }
${sheetCss()}`;
}
