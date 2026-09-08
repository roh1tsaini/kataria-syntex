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

export type SheetItem = {
  boxNo: string;
  lotNo: string;
  cheese: number;
  grossWt: number;
  tareWt: number;
  netWt: number;
  denierName: string;
  colorName: string;
};

type SheetParty = {
  name: string;
  address: string | null;
  phone: string | null;
};

export type SheetCompany = {
  name: string;
  gstin: string | null;
  pan?: string | null;
  address: string | null;
  phone1: string | null;
  phone2: string | null;
};

export type SheetDetail = {
  challan: {
    challanNumber: string;
    date: string;
    customerGstin: string | null;
    notes: string | null;
    totalBoxes: number;
    totalCheese: number;
    totalGrossWt: number;
    totalTareWt: number;
    totalNetWt: number;
  };
  items: SheetItem[];
  customer: SheetParty | null;
  jobWorker: SheetParty | null;
};

export type ChallanType = "sales" | "outward";

const ROWS_PER_PAGE = 12;
export const SHEET_W_MM = 210;
export const SHEET_H_MM = 148;

const fmtWt3 = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "0.000");
const fmtInt = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "0";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

function paginateItems(items: SheetItem[]): SheetItem[][] {
  const pages: SheetItem[][] = [];
  for (let i = 0; i < items.length; i += ROWS_PER_PAGE)
    pages.push(items.slice(i, i + ROWS_PER_PAGE));
  return pages.length > 0 ? pages : [[]];
}

/** Document title line(s) for the masthead's left block. */
const titleLines = (type: ChallanType): string[] =>
  type === "outward" ? ["JOBWORK", "DELIVERY CHALLAN"] : ["DELIVERY CHALLAN"];

// ── Escaping / small builders ────────────────────────────────────────────────

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const esc = (value: string | null | undefined): string =>
  escapeHtml(value?.trim() ?? "");

/** Trailing punctuation a human may have typed into a phone/address field. */
const clean = (value: string | null | undefined): string =>
  value?.trim().replace(/[\s,;]+$/, "") ?? "";

// ── Sheet CSS ────────────────────────────────────────────────────────────────

/**
 * Print-exact stylesheet. The sheet is a fixed A5-landscape box; every zone
 * is a grid row so no dynamic value can push later zones off the page.
 */
function sheetCss(): string {
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
function fontFaceCss(fonts: ChallanFonts): string {
  return `
@font-face { font-family:"Inter Print"; font-weight:400; font-style:normal;
  src:url(data:font/ttf;base64,${fonts.regular}) format("truetype"); }
@font-face { font-family:"Inter Print"; font-weight:700; font-style:normal;
  src:url(data:font/ttf;base64,${fonts.bold}) format("truetype"); }`;
}

/** Full-document CSS: fonts inlined so every renderer typesets identical glyphs. */
function docCss(fonts: ChallanFonts): string {
  return `
${fontFaceCss(fonts)}
@page { size:${SHEET_W_MM}mm ${SHEET_H_MM}mm; margin:0; }
${sheetCss()}`;
}

// ── Sheet markup ─────────────────────────────────────────────────────────────

function masthead(type: ChallanType, company: SheetCompany | null): string {
  const phones = [clean(company?.phone1), clean(company?.phone2)]
    .filter(Boolean)
    .join(", ");
  const contact = phones ? `Contact No.: ${escapeHtml(phones)}` : "";
  const lines = titleLines(type)
    .map((l) => escapeHtml(l))
    .join("<br>");
  return `
<div class="masthead">
  <div class="doc-title">${lines}</div>
  <div class="company">
    <div class="company-name">${esc(company?.name).toUpperCase()}</div>
    <div class="company-sub">${esc(company?.address).toUpperCase()}</div>
    ${contact ? `<div class="company-sub">${contact}</div>` : ""}
  </div>
  <div class="copies">
    <div class="copy">ORIGINAL</div>
    <div class="copy">DUPLICATE</div>
  </div>
</div>
<hr class="masthead-rule">`;
}

function partyBand(detail: SheetDetail, type: ChallanType): string {
  const party = type === "sales" ? detail.customer : detail.jobWorker;
  const gstin =
    type === "sales" ? clean(detail.challan.customerGstin).toUpperCase() : "";
  const partyAddress = clean(party?.address).toUpperCase();
  const partyPhone = clean(party?.phone);
  const subParts = [
    partyAddress ? `<span>${escapeHtml(partyAddress)}</span>` : "",
    partyPhone ? `<span>Mobile: ${escapeHtml(partyPhone)}</span>` : "",
  ].filter(Boolean);

  return `
<div class="party">
  <div class="party-main">
    <div class="party-line">
      <span class="party-ms">M/s</span>
      <span class="party-name">${esc(party?.name).toUpperCase()}</span>
      ${gstin ? `<span class="party-gstin">GSTIN: ${escapeHtml(gstin)}</span>` : ""}
    </div>
    ${subParts.length > 0 ? `<div class="party-sub">${subParts.join("")}</div>` : ""}
  </div>
  <div class="party-meta">
    <div class="meta-row"><span class="meta-label">CHALLAN NO.</span>
      <span class="meta-value">${esc(detail.challan.challanNumber)}</span></div>
    <div class="meta-row"><span class="meta-label">DATE</span>
      <span class="meta-value">${esc(fmtDate(detail.challan.date))}</span></div>
  </div>
</div>`;
}

function itemsTable(pageItems: SheetItem[], pageIndex: number): string {
  const cols: Array<{ label: string; width: string }> = [
    { label: "SR.", width: "7mm" },
    { label: "BOX NO.", width: "17mm" },
    { label: "CHEESE", width: "15mm" },
    { label: "GROSS WT.", width: "21mm" },
    { label: "TARE WT.", width: "19mm" },
    { label: "NET WT.", width: "21mm" },
    { label: "DENIER", width: "28mm" },
    { label: "COLOR", width: "1fr" },
    { label: "LOT NO.", width: "20mm" },
  ];
  const head = cols
    .map((c) => `<th style="width:${c.width}">${c.label}</th>`)
    .join("");

  const rows: string[] = [];
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const item = pageItems[i];
    const cells = item
      ? [
          String(pageIndex * ROWS_PER_PAGE + i + 1),
          esc(item.boxNo),
          fmtInt(item.cheese),
          fmtWt3(item.grossWt),
          fmtWt3(item.tareWt),
          fmtWt3(item.netWt),
          esc(item.denierName),
          esc(item.colorName),
          esc(item.lotNo),
        ]
      : Array.from({ length: cols.length }, () => "");
    rows.push(`<tr>${cells.map((v) => `<td>${v}</td>`).join("")}</tr>`);
  }

  return `
<table class="items">
  <thead><tr>${head}</tr></thead>
  <tbody>${rows.join("")}</tbody>
</table>`;
}

function totalsZone(detail: SheetDetail, company: SheetCompany | null): string {
  const gstin = clean(company?.gstin).toUpperCase();
  const pan = clean(company?.pan).toUpperCase();
  const left = [
    gstin
      ? `<div class="stat-line"><span class="lbl">GSTIN:</span> ${escapeHtml(gstin)}</div>`
      : "",
    pan
      ? `<div class="stat-line"><span class="lbl">PAN No.:</span> ${escapeHtml(pan)}</div>`
      : "",
  ].join("");
  const remarks = esc(detail.challan.notes).toUpperCase();
  const remarksLine = remarks
    ? `<div class="remarks-line"><b>Remarks:</b> ${remarks}</div>`
    : "";

  const rows: Array<[string, string]> = [
    ["Total Box", fmtInt(detail.challan.totalBoxes)],
    ["Total Cheese", fmtInt(detail.challan.totalCheese)],
    ["Total Gross Wt.", fmtWt3(detail.challan.totalGrossWt)],
    ["Total Tare Wt.", fmtWt3(detail.challan.totalTareWt)],
  ];

  return `
<div class="totals">
  <div class="totals-left">${left}${remarksLine}</div>
  <div class="totals-right">
    ${rows
      .map(
        ([l, v]) =>
          `<div class="tot-row"><span class="lbl">${l}</span><span class="val">${v}</span></div>`,
      )
      .join("")}
    <hr class="tot-rule">
    <div class="tot-row final"><span class="lbl">Total Net Wt.</span>
      <span class="val">${fmtWt3(detail.challan.totalNetWt)}</span></div>
  </div>
</div>`;
}

function footer(
  company: SheetCompany | null,
  pageIndex: number,
  pageCount: number,
): string {
  return `
<hr class="foot-rule">
<div class="footer">
  <div class="terms">
    <h3>Terms &amp; Conditions</h3>
    <ol>
      <li>Please do not mix different lots.</li>
      <li>Subject to SURAT jurisdiction.</li>
    </ol>
  </div>
  <div class="sign-cell">
    <div class="sign-line"></div>
    <div class="sign-cap">Receiver's Sign.</div>
  </div>
  <div class="auth-cell">
    <div class="auth-for">For ${esc(company?.name).toUpperCase()}</div>
    <div class="auth-line"></div>
    <div class="auth-cap">AUTHORISED SIGNATORY</div>
  </div>
</div>
${pageCount > 1 ? `<div class="page-no">Page ${pageIndex + 1} of ${pageCount}</div>` : ""}`;
}

// ── Public builders ──────────────────────────────────────────────────────────

export type ChallanFonts = { regular: string; bold: string };
export type ChallanHtmlInput = {
  detail: SheetDetail;
  company: SheetCompany | null;
  type: ChallanType;
  fonts: ChallanFonts;
};

/**
 * The sheet markup itself: one `<style>` block (inline Inter fonts + sheet
 * rules) plus one `.sheet` div per dozen items. Both the standalone document
 * and the in-app print page render exactly this, so screen, print and both
 * PDF pipelines can never drift.
 */
export function buildChallanSheets(input: ChallanHtmlInput): {
  css: string;
  body: string;
} {
  const pages = paginateItems(input.detail.items);
  const body = pages
    .map(
      (_, i) =>
        `<div class="sheet">${masthead(input.type, input.company)}${partyBand(
          input.detail,
          input.type,
        )}${itemsTable(pages[i], i)}${totalsZone(input.detail, input.company)}${footer(
          input.company,
          i,
          pages.length,
        )}</div>`,
    )
    .join("\n");
  return { css: `${fontFaceCss(input.fonts)}\n${sheetCss()}`, body };
}

/** Complete standalone HTML document — the input to both PDF pipelines. */
export function buildChallanHtml(input: ChallanHtmlInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Challan ${escapeHtml(input.detail.challan.challanNumber)}</title>
<style>${docCss(input.fonts)}</style>
</head>
<body>
${buildChallanSheets(input).body}
</body>
</html>`;
}
