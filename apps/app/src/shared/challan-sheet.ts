import {
  CHALLAN_ROWS_PER_PAGE,
  CHALLAN_TERMS_AND_CONDITIONS,
} from "@kataria-syntex/shared";
import type {
  ChallanHtmlInput,
  ChallanType,
  SheetCompany,
  SheetDetail,
  SheetItem,
} from "./challan-types";
import { fontFaceCss, sheetCss } from "./challan-css";

const ROWS_PER_PAGE = CHALLAN_ROWS_PER_PAGE;

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

export const escapeHtml = (value: string): string =>
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

export function masthead(
  type: ChallanType,
  company: SheetCompany | null,
): string {
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

export function partyBand(detail: SheetDetail, type: ChallanType): string {
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

export function itemsTable(pageItems: SheetItem[], pageIndex: number): string {
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

export function totalsZone(
  detail: SheetDetail,
  company: SheetCompany | null,
): string {
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

export function footer(
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
      ${CHALLAN_TERMS_AND_CONDITIONS.map((term) => `<li>${esc(term)}</li>`).join("")}
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
