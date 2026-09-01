/**
 * Delivery Challan sheet — shared drawing core and single source of truth for
 * the template geometry.
 *
 * Platform-neutral: `drawChallanSheet` issues primitive draw ops through the
 * SheetDoc interface. Both server and offline client render with pdf-lib
 * (pure JS, works on Cloudflare Workers and fully offline), so online,
 * offline, and Electron/Capacitor prints are byte-identical. The browser
 * print replica (challan-document.tsx) consumes the same exported geometry —
 * keep all three in sync through this module.
 *
 * Typography: Inter (Regular/Bold), bundled locally — no CDN, no system
 * fallbacks. Optical vertical centering uses the font's real cap-height ratio
 * (SheetDoc.capRatio), so every renderer lands glyphs identically.
 *
 * Coordinate contract: top-left origin, points. `SheetDoc.text` takes the
 * exact BASELINE y (not a box top).
 *
 * Overflow contract: every dynamic string is measured and shrunk/ellipsized to
 * its column, so no data length can ever overlap or clip.
 */

export const SHEET_W = 595.32;
export const SHEET_H = 419.52;
export const ROWS_PER_PAGE = 12;

// ── Palette (grayscale-safe: prints on any mono printer) ────────────────────
export const INK = "#000000";
export const LABEL = "#52525b";
export const FAINT = "#a1a1aa";
export const BAND = "#f4f4f5";
export const ROWRULE = "#e4e4e7";
const HEADER_TEXT = "#3f3f46";

// ── Geometry (top-left origin, points; text values are baselines) ───────────

export const MARGIN = 18;
export const RIGHT_EDGE = SHEET_W - MARGIN;

export const MASTHEAD = {
  nameBl: 30,
  nameSize: 17,
  nameMaxW: 236,
  addrBl: 41.5,
  contactBl: 51.5,
  subSize: 7.5,
  titleBl: 24,
  titleSize: 12.5,
  chipTop: 31,
  chipW: 62,
  chipH: 13,
  chipGap: 6,
  chipTextSize: 6.5,
  dividerY: 60,
  dividerW: 1.5,
};

export const INFO = {
  top: 68,
  bottom: 107,
  dividerX: 400,
  labelBl: 74,
  labelSize: 6.5,
  nameBl: 87,
  nameSize: 11,
  gstinRail: 392,
  gstinSize: 8,
  subBl: 99,
  subSize: 8,
  metaX: 412,
  metaLabelBl1: 74,
  metaValueBl1: 88,
  metaValueSize: 14,
  metaLabelBl2: 95.5,
  metaValueBl2: 105,
  dateValueSize: 11,
};

export const TABLE = {
  x: MARGIN,
  w: RIGHT_EDGE - MARGIN,
  headY: 112,
  headH: 17,
  bodyTop: 129,
  bodyBottom: 303,
};
export const ROW_H = (TABLE.bodyBottom - TABLE.bodyTop) / ROWS_PER_PAGE;

/** Column boundaries left→right; COLS[i] spans BOUNDS[i]..BOUNDS[i+1]. */
export const BOUNDS = [
  18,
  34,
  88,
  124,
  176,
  224,
  278,
  398,
  494,
  RIGHT_EDGE,
] as const;

type ColAlign = "left" | "center" | "right";
export type ColumnSpec = {
  label: string;
  align: ColAlign;
  pad?: number;
};

export const COLS: ColumnSpec[] = [
  { label: "Sr.", align: "left", pad: 3 },
  { label: "Box No.", align: "center" },
  { label: "Cheese", align: "center" },
  { label: "Gross Wt.", align: "right", pad: 5 },
  { label: "Less Wt.", align: "right", pad: 5 },
  { label: "Nett Wt.", align: "right", pad: 5 },
  { label: "Denier", align: "left", pad: 5 },
  { label: "Color", align: "left", pad: 5 },
  { label: "Lot No.", align: "center" },
];

export const TOTALS = {
  leftX: MARGIN,
  gstinBl: 316,
  panBl: 328,
  remarksBl: 341,
  labelX: 420,
  valueR: RIGHT_EDGE,
  /** First four rows; the emphasised nett row sits below its own rule. */
  baselines: [315, 324.5, 334, 343.5],
  ruleY: 349.5,
  finalBl: 358,
};

export const FOOTER = {
  ruleY: 364,
  termsX: MARGIN,
  termsTitleBl: 376,
  termsTitle: "Terms & Conditions",
  termsSize: 8,
  termsItems: [
    { bl: 386, text: "1. Please do not mix different lot." },
    { bl: 395, text: "2. Subject to SURAT Jurisdiction." },
  ],
  receiverLineX1: 232,
  receiverLineX2: 322,
  signLineY: 384,
  signLabelBl: 393.5,
  forBl: 376,
  forSize: 9.5,
  authBl: 393.5,
  authSize: 6.5,
  pageBl: 410.5,
  pageSize: 6.5,
};

const BODY_SIZE = 9;
const HEAD_SIZE = 7;
const ELLIPSIS = "…";

// ── Text metrics / fitting ───────────────────────────────────────────────────

/**
 * Shrinks `value` until it fits `maxW` at some size in [minSize, baseSize],
 * then ellipsizes as a last resort. Returns the drawn text and its size.
 */
function fitText(
  doc: SheetDoc,
  value: string,
  maxW: number,
  baseSize = BODY_SIZE,
  minSize = BODY_SIZE,
): { text: string; size: number } {
  let text = value;
  let size = baseSize;
  if (!text) return { text, size };
  if (doc.widthOf(text, size) <= maxW) return { text, size };
  while (size > minSize && doc.widthOf(text, size) > maxW) size -= 0.25;
  if (doc.widthOf(text, size) <= maxW) return { text, size };
  while (text.length > 1 && doc.widthOf(text + ELLIPSIS, minSize) > maxW)
    text = text.slice(0, -1);
  return { text: text + ELLIPSIS, size: minSize };
}

/** Minimal drawing surface both renderers (server + offline pdf-lib) provide. */
export interface SheetDoc {
  addPage(): void;
  /**
   * Draws a single line of text. `y` is the exact BASELINE measured from the
   * sheet's top edge. `color` is a #rrggbb hex.
   */
  text(
    value: string,
    x: number,
    y: number,
    size: number,
    bold: boolean,
    opts?: {
      width?: number;
      align?: "left" | "center" | "right";
      color?: string;
    },
  ): void;
  /** Strokes a rectangle border. */
  rect(x: number, y: number, w: number, h: number, color?: string): void;
  /** Strokes or fills a fully-rounded (pill) rectangle. */
  pill(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { border?: string; fill?: string },
  ): void;
  /** Fills a rectangle. */
  fillRect(x: number, y: number, w: number, h: number, color?: string): void;
  /** Strokes a line between two points. */
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width?: number,
    color?: string,
  ): void;
  /** Width of `value` rendered at `size`, in points. */
  widthOf(value: string, size: number, bold?: boolean): number;
  /** Cap-height ÷ em of the embedded font (Inter: 0.72754). */
  capRatio(): number;
}

/** Structural subset of the challan/party/company rows the sheet needs. */
type SheetChallan = {
  challanNumber: string;
  date: string; // YYYY-MM-DD
  customerGstin: string | null;
  notes: string | null;
  totalBoxes: number;
  totalCheese: number;
  totalGrossWt: number;
  totalTareWt: number;
  totalNetWt: number;
};

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
  challan: SheetChallan;
  items: SheetItem[];
  customer: SheetParty | null;
  jobWorker: SheetParty | null;
};

export const fmtWt3 = (n: number) =>
  Number.isFinite(n) ? n.toFixed(3) : "0.000";
export const fmtInt = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "0";

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y.slice(2)}`;
};

/** Single-line document title for the masthead's right block. */
export const titleFor = (type: "sales" | "outward"): string =>
  type === "outward" ? "JOBWORK DELIVERY CHALLAN" : "DELIVERY CHALLAN";

/** Optical baseline that vertically centers cap-height text within a band. */
const centerBl = (cap: number, size: number, top: number, bottom: number) =>
  (top + bottom) / 2 + (cap * size) / 2;

/** Draws one cell's text with alignment/padding and shrink-to-fit. */
function drawCellText(
  doc: SheetDoc,
  value: string,
  col: ColumnSpec,
  i: number,
  y: number,
  bold: boolean,
  size: number,
  color: string,
): void {
  if (!value) return;
  const x0 = BOUNDS[i];
  const w = BOUNDS[i + 1] - x0;
  const pad = col.pad ?? 0;
  const fit = fitText(doc, value, Math.max(w - pad * 2, 8), size, size - 2);
  if (col.align === "center") {
    doc.text(fit.text, x0 + pad, y, fit.size, bold, {
      width: w - pad * 2,
      align: "center",
      color,
    });
  } else if (col.align === "right") {
    doc.text(fit.text, x0, y, fit.size, bold, {
      width: w - pad,
      align: "right",
      color,
    });
  } else {
    doc.text(fit.text, x0 + pad, y, fit.size, bold, { color });
  }
}

/** Draws one complete sheet (call once per page chunk of items). */
export function drawChallanSheet(
  doc: SheetDoc,
  detail: SheetDetail,
  company: SheetCompany | null,
  type: "sales" | "outward",
  items: SheetItem[],
  pageIndex = 0,
  pageCount = 1,
): void {
  const cap = doc.capRatio();
  const { challan } = detail;
  const party = type === "sales" ? detail.customer : detail.jobWorker;
  const companyName = (company?.name ?? "").trim().toUpperCase();
  const partyName = (party?.name ?? "").toUpperCase();
  const address = (company?.address ?? "").trim().toUpperCase();
  const phones = [company?.phone1, company?.phone2]
    .map((p) => p?.trim().replace(/[\s,;]+$/, ""))
    .filter(Boolean)
    .join(", ");
  const partyAddress = (party?.address ?? "").trim().toUpperCase();
  const partyPhone = party?.phone?.trim() ?? "";

  // ── Masthead ─────────────────────────────────────────────────────────
  const nameFit = fitText(
    doc,
    companyName,
    MASTHEAD.nameMaxW,
    MASTHEAD.nameSize,
    10,
  );
  doc.text(nameFit.text, MARGIN, MASTHEAD.nameBl, nameFit.size, true);

  const addrFit = fitText(
    doc,
    address,
    INFO.dividerX - MARGIN - 24,
    MASTHEAD.subSize,
    6,
  );
  doc.text(addrFit.text, MARGIN, MASTHEAD.addrBl, addrFit.size, false, {
    color: LABEL,
  });
  if (phones) {
    const contactFit = fitText(
      doc,
      `Contact No.: ${phones}`,
      INFO.dividerX - MARGIN - 24,
      MASTHEAD.subSize,
      6,
    );
    doc.text(
      contactFit.text,
      MARGIN,
      MASTHEAD.contactBl,
      contactFit.size,
      false,
      {
        color: LABEL,
      },
    );
  }

  const title = titleFor(type);
  const titleFit = fitText(
    doc,
    title,
    RIGHT_EDGE - INFO.dividerX - 8,
    MASTHEAD.titleSize,
    9,
  );
  doc.text(
    titleFit.text,
    INFO.dividerX + 8,
    MASTHEAD.titleBl,
    titleFit.size,
    true,
    {
      width: RIGHT_EDGE - INFO.dividerX - 8,
      align: "right",
    },
  );

  const chipX2 = RIGHT_EDGE - MASTHEAD.chipW;
  const chipX1 = chipX2 - MASTHEAD.chipGap - MASTHEAD.chipW;
  for (const [i, label] of ["ORIGINAL", "DUPLICATE"].entries()) {
    const x = i === 0 ? chipX1 : chipX2;
    doc.pill(x, MASTHEAD.chipTop, MASTHEAD.chipW, MASTHEAD.chipH, {
      border: INK,
    });
    doc.text(
      label,
      x,
      centerBl(
        cap,
        MASTHEAD.chipTextSize,
        MASTHEAD.chipTop,
        MASTHEAD.chipTop + MASTHEAD.chipH,
      ),
      MASTHEAD.chipTextSize,
      true,
      {
        width: MASTHEAD.chipW,
        align: "center",
      },
    );
  }

  doc.line(
    MARGIN,
    MASTHEAD.dividerY,
    RIGHT_EDGE,
    MASTHEAD.dividerY,
    MASTHEAD.dividerW,
    INK,
  );

  // ── Info band: party (left) + challan meta (right) ───────────────────
  doc.line(INFO.dividerX, INFO.top, INFO.dividerX, INFO.bottom, 0.7, ROWRULE);

  doc.text("M/S", MARGIN, INFO.labelBl, INFO.labelSize, true, { color: LABEL });
  const partyGstin =
    type === "sales" && challan.customerGstin
      ? `GSTIN : ${challan.customerGstin.toUpperCase()}`
      : "";
  const nameMax =
    (partyGstin ? INFO.gstinRail - 130 : INFO.gstinRail) - MARGIN - 8;
  const partyFit = fitText(doc, partyName, nameMax, INFO.nameSize, 8);
  doc.text(partyFit.text, MARGIN, INFO.nameBl, partyFit.size, true);
  if (partyGstin) {
    const gstinX = MARGIN + nameMax + 8;
    const gstinFit = fitText(
      doc,
      partyGstin,
      INFO.gstinRail - gstinX - 2,
      INFO.gstinSize,
      6.5,
    );
    doc.text(gstinFit.text, gstinX, INFO.nameBl, gstinFit.size, true, {
      width: INFO.gstinRail - gstinX,
      align: "right",
    });
  }

  const addrPartyFit = fitText(
    doc,
    partyAddress,
    INFO.dividerX - MARGIN - (partyPhone ? 96 : 8),
    INFO.subSize,
    6.5,
  );
  doc.text(addrPartyFit.text, MARGIN, INFO.subBl, addrPartyFit.size, false, {
    color: LABEL,
  });
  if (partyPhone) {
    const mobileFit = fitText(
      doc,
      `Mobile : ${partyPhone}`,
      92,
      INFO.subSize,
      6.5,
    );
    doc.text(
      mobileFit.text,
      INFO.dividerX - 8 - doc.widthOf(mobileFit.text, mobileFit.size),
      INFO.subBl,
      mobileFit.size,
      false,
      {
        color: LABEL,
      },
    );
  }

  doc.text("CHALLAN NO.", INFO.metaX, INFO.metaLabelBl1, INFO.labelSize, true, {
    color: LABEL,
  });
  const numFit = fitText(
    doc,
    challan.challanNumber,
    RIGHT_EDGE - INFO.metaX,
    INFO.metaValueSize,
    8,
  );
  doc.text(numFit.text, INFO.metaX, INFO.metaValueBl1, numFit.size, true);

  doc.text("DATE", INFO.metaX, INFO.metaLabelBl2, INFO.labelSize, true, {
    color: LABEL,
  });
  const dateFit = fitText(
    doc,
    fmtDate(challan.date),
    RIGHT_EDGE - INFO.metaX,
    INFO.dateValueSize,
    8,
  );
  doc.text(dateFit.text, INFO.metaX, INFO.metaValueBl2, dateFit.size, true);

  // ── Items table ──────────────────────────────────────────────────────
  doc.fillRect(TABLE.x, TABLE.headY, TABLE.w, TABLE.headH, BAND);

  const headBl = centerBl(
    cap,
    HEAD_SIZE,
    TABLE.headY,
    TABLE.headY + TABLE.headH,
  );
  COLS.forEach((col, i) =>
    drawCellText(
      doc,
      col.label.toUpperCase(),
      col,
      i,
      headBl,
      true,
      HEAD_SIZE,
      HEADER_TEXT,
    ),
  );
  doc.line(TABLE.x, TABLE.bodyTop, TABLE.x + TABLE.w, TABLE.bodyTop, 0.9, INK);

  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const item = items[i];
    const rowBottom = TABLE.bodyTop + (i + 1) * ROW_H;
    const bl = TABLE.bodyTop + i * ROW_H + ROW_H / 2 + (cap * BODY_SIZE) / 2;
    const values = item
      ? [
          String(pageIndex * ROWS_PER_PAGE + i + 1),
          item.boxNo,
          fmtInt(item.cheese),
          fmtWt3(item.grossWt),
          fmtWt3(item.tareWt),
          fmtWt3(item.netWt),
          item.denierName,
          item.colorName,
          item.lotNo,
        ]
      : Array.from({ length: COLS.length }, () => "");

    COLS.forEach((col, c) =>
      drawCellText(doc, values[c], col, c, bl, false, BODY_SIZE, INK),
    );

    const isLast = i === ROWS_PER_PAGE - 1;
    doc.line(
      TABLE.x,
      rowBottom,
      TABLE.x + TABLE.w,
      rowBottom,
      isLast ? 0.9 : 0.5,
      isLast ? INK : ROWRULE,
    );
  }

  // ── Totals zone ──────────────────────────────────────────────────────
  const gstinLine = `GSTIN : ${company?.gstin ?? ""}`.trimEnd();
  const gstinFitL = fitText(doc, gstinLine, INFO.dividerX - TOTALS.leftX - 8);
  doc.text(gstinFitL.text, TOTALS.leftX, TOTALS.gstinBl, gstinFitL.size, true);
  const panLine = `PAN No. : ${company?.pan ?? ""}`.trimEnd();
  const panFit = fitText(doc, panLine, INFO.dividerX - TOTALS.leftX - 8);
  doc.text(panFit.text, TOTALS.leftX, TOTALS.panBl, panFit.size, true);

  const remarks = challan.notes?.trim().toUpperCase() ?? "";
  doc.text("Remarks :", TOTALS.leftX, TOTALS.remarksBl, BODY_SIZE, true);
  if (remarks) {
    const remX = TOTALS.leftX + doc.widthOf("Remarks :", BODY_SIZE, true) + 4;
    const remFit = fitText(doc, remarks, INFO.dividerX - remX - 8);
    doc.text(remFit.text, remX, TOTALS.remarksBl, remFit.size, false, {
      color: LABEL,
    });
  }

  const rows: Array<[string, string]> = [
    ["Total Box", fmtInt(challan.totalBoxes)],
    ["Total Cheese", fmtInt(challan.totalCheese)],
    ["Total Gross Wt.", fmtWt3(challan.totalGrossWt)],
    ["Total Less Wt.", fmtWt3(challan.totalTareWt)],
  ];
  rows.forEach(([label, value], i) => {
    const bl = TOTALS.baselines[i];
    doc.text(label, TOTALS.labelX, bl, BODY_SIZE, false, { color: LABEL });
    doc.text(value, TOTALS.labelX, bl, BODY_SIZE, true, {
      width: TOTALS.valueR - TOTALS.labelX,
      align: "right",
    });
  });
  doc.line(
    TOTALS.labelX,
    TOTALS.ruleY,
    TOTALS.valueR,
    TOTALS.ruleY,
    0.7,
    ROWRULE,
  );
  doc.text("Total Nett Wt.", TOTALS.labelX, TOTALS.finalBl, BODY_SIZE, true);
  doc.text(
    fmtWt3(challan.totalNetWt),
    TOTALS.labelX,
    TOTALS.finalBl,
    9.5,
    true,
    {
      width: TOTALS.valueR - TOTALS.labelX,
      align: "right",
    },
  );

  // ── Footer ───────────────────────────────────────────────────────────
  doc.line(TABLE.x, FOOTER.ruleY, TABLE.x + TABLE.w, FOOTER.ruleY, 0.7, INK);

  doc.text(
    FOOTER.termsTitle,
    FOOTER.termsX,
    FOOTER.termsTitleBl,
    FOOTER.termsSize,
    true,
  );
  FOOTER.termsItems.forEach((item) => {
    doc.text(item.text, FOOTER.termsX, item.bl, FOOTER.termsSize - 0.5, false, {
      color: LABEL,
    });
  });

  doc.line(
    FOOTER.receiverLineX1,
    FOOTER.signLineY,
    FOOTER.receiverLineX2,
    FOOTER.signLineY,
    0.7,
    ROWRULE,
  );
  doc.text(
    "Receiver's Sign.",
    FOOTER.receiverLineX1,
    FOOTER.signLabelBl,
    FOOTER.termsSize - 0.5,
    false,
    {
      width: FOOTER.receiverLineX2 - FOOTER.receiverLineX1,
      align: "center",
      color: LABEL,
    },
  );

  const forAnchorX = 420;
  const forMax = RIGHT_EDGE - forAnchorX;
  const forFit = fitText(
    doc,
    `For ${companyName}`,
    forMax,
    FOOTER.forSize,
    7.5,
  );
  doc.text(forFit.text, forAnchorX, FOOTER.forBl, forFit.size, true, {
    width: forMax,
    align: "right",
  });
  doc.line(467, FOOTER.signLineY, RIGHT_EDGE, FOOTER.signLineY, 0.7, ROWRULE);
  const authFit = fitText(
    doc,
    "AUTHORISED SIGNATORY",
    forMax,
    FOOTER.authSize,
    FOOTER.authSize,
  );
  doc.text(authFit.text, forAnchorX, FOOTER.authBl, authFit.size, true, {
    width: forMax,
    align: "right",
    color: LABEL,
  });

  if (pageCount > 1) {
    doc.text(
      `Page ${pageIndex + 1} of ${pageCount}`,
      MARGIN,
      FOOTER.pageBl,
      FOOTER.pageSize,
      false,
      { width: TABLE.w, align: "center", color: FAINT },
    );
  }
}

/** Splits items into page chunks (one sheet per ROWS_PER_PAGE rows). */
export function paginateItems(items: SheetItem[]): SheetItem[][] {
  const pages: SheetItem[][] = [];
  for (let i = 0; i < items.length; i += ROWS_PER_PAGE)
    pages.push(items.slice(i, i + ROWS_PER_PAGE));
  if (pages.length === 0) pages.push([]);
  return pages;
}
