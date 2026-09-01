import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ChallanDetail } from "@/store/challans";
import type { Company } from "@/store/auth";
import {
  BAND,
  BOUNDS,
  COLS,
  FAINT,
  FOOTER,
  INFO,
  INK,
  LABEL,
  MARGIN,
  MASTHEAD,
  RIGHT_EDGE,
  ROWS_PER_PAGE,
  ROW_H,
  ROWRULE,
  SHEET_H,
  SHEET_W,
  TABLE,
  TOTALS,
  fmtDate,
  fmtInt,
  fmtWt3,
  titleFor,
  type ColumnSpec,
} from "../../../shared/pdf-template";
import interBoldUrl from "../../../shared/fonts/Inter-Bold.ttf?url";
import interRegularUrl from "../../../shared/fonts/Inter-Regular.ttf?url";

/**
 * Pixel-faithful print replica of the Delivery Challan. All geometry comes
 * from src/shared/pdf-template.ts — the same coordinates both server and
 * offline pdf-lib renderers draw with, so screen, print and PDF outputs are
 * identical. Sheet is 595.32 x 419.52 pt, one sheet per 12 line items.
 *
 * Typography is the SAME embedded Inter (OFL, bundled locally — no CDN) the
 * PDF renderers use, registered here as "Inter Print" so the replica never
 * depends on whatever subset the app shell loaded.
 */

const FONT = '"Inter Print", "Inter Variable", sans-serif';
// Print ink, not theme tokens: this sheet is a legal document that must stay
// black-on-white paper in both themes and in print. Theme tokens invert in
// dark mode and would corrupt print.
const HEADER_TEXT = "#3f3f46";
// Inter static TTF metrics (UPM 2048): typo ascender 1980 / descender -494 /
// cap height 1490. Blink lays each line out in whole px (floored
// ascent/descent, floored baseline), so we replicate its exact algorithm per
// font size instead of a single ratio.
const ASCENT = 1980 / 2048;
const DESCENT = 494 / 2048;
const CAP = 1490 / 2048;

/** Baseline offset (pt) from the top of a line-height:1 box at `size` pt. */
function baselineOffset(size: number): number {
  const em = (size * 96) / 72;
  const asc = Math.floor(ASCENT * em);
  const desc = Math.floor(DESCENT * em);
  return Math.floor((em - (asc + desc)) / 2 + asc) / (96 / 72);
}

/** CSS `top` that puts a line-height:1 element's baseline exactly on `pt`. */
const blTop = (baseline: number, size: number): CSSProperties => ({
  top: `${baseline - baselineOffset(size)}pt`,
});

/** Optical baseline centering cap-height text within [top, bottom] (PDF parity). */
const centerBl = (size: number, top: number, bottom: number) =>
  (top + bottom) / 2 + (CAP * size) / 2;

const t = (size: number, weight = 400, color = INK): CSSProperties => ({
  fontFamily: FONT,
  fontSize: `${size}pt`,
  fontWeight: weight,
  lineHeight: 1,
  color,
  whiteSpace: "nowrap",
});

const abs = (style: CSSProperties): CSSProperties => ({
  position: "absolute",
  ...style,
});

/** Shrink-to-fit span: clips with an ellipsis instead of ever overflowing. */
function Fit({
  w,
  children,
  style,
}: {
  w: number | string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: typeof w === "number" ? `${w}pt` : w,
        overflow: "hidden",
        textOverflow: "ellipsis",
        verticalAlign: "bottom",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

let measureCtx: CanvasRenderingContext2D | null = null;
const PT_TO_PX = 96 / 72;

/** Shrinks a font size until `text` fits `maxW` pt — mirrors the PDF path. */
function fitFontSize(
  text: string,
  maxW: number,
  baseSize: number,
  minSize: number,
  weight = 400,
): number {
  if (typeof document === "undefined") return baseSize;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return baseSize;
  const maxPx = maxW * PT_TO_PX;
  let size = baseSize;
  while (size > minSize) {
    measureCtx.font = `${weight} ${(size * PT_TO_PX).toFixed(2)}px ${FONT}`;
    if (measureCtx.measureText(text).width <= maxPx) break;
    size -= 0.5;
  }
  return size;
}

const justify = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

/** Registers the exact Inter faces the PDF renderers embed — once per page. */
function InterPrintFaces() {
  return (
    <style>{`
      @font-face {
        font-family: "Inter Print";
        font-style: normal;
        font-weight: 400;
        font-display: block;
        src: url(${interRegularUrl}) format("truetype");
      }
      @font-face {
        font-family: "Inter Print";
        font-style: normal;
        font-weight: 700;
        font-display: block;
        src: url(${interBoldUrl}) format("truetype");
      }
    `}</style>
  );
}

type SheetProps = {
  detail: ChallanDetail;
  company: Company | null;
  type: "sales" | "outward";
  items: ChallanDetail["items"];
  pageIndex: number;
  pageCount: number;
};

function Sheet({
  detail,
  company,
  type,
  items,
  pageIndex,
  pageCount,
}: SheetProps) {
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
  const partyGstin =
    type === "sales" && challan.customerGstin
      ? `GSTIN : ${challan.customerGstin.toUpperCase()}`
      : "";

  const nameFontSize = fitFontSize(
    companyName,
    MASTHEAD.nameMaxW,
    MASTHEAD.nameSize,
    10,
    700,
  );
  const partyNameMax =
    (partyGstin ? INFO.gstinRail - 130 : INFO.gstinRail) - MARGIN - 8;
  const partyFontSize = fitFontSize(
    partyName,
    partyNameMax,
    INFO.nameSize,
    8,
    700,
  );
  const titleFontSize = fitFontSize(
    titleFor(type),
    RIGHT_EDGE - INFO.dividerX - 8,
    MASTHEAD.titleSize,
    9,
    700,
  );
  const numberFontSize = fitFontSize(
    challan.challanNumber,
    RIGHT_EDGE - INFO.metaX,
    INFO.metaValueSize,
    8,
    700,
  );
  const dateFontSize = fitFontSize(
    fmtDate(challan.date),
    RIGHT_EDGE - INFO.metaX,
    INFO.dateValueSize,
    8,
    700,
  );
  const forFontSize = fitFontSize(
    `For ${companyName}`,
    RIGHT_EDGE - 420,
    FOOTER.forSize,
    7.5,
    700,
  );

  const colWidth = (i: number) => BOUNDS[i + 1] - BOUNDS[i];

  const cellStyle = (col: ColumnSpec, i: number): CSSProperties => ({
    width: `${colWidth(i)}pt`,
    boxSizing: "border-box",
    paddingInline: `${col.pad ?? 0}pt`,
    display: "flex",
    alignItems: "center",
    justifyContent: justify[col.align],
  });

  const totals: Array<[string, string]> = [
    ["Total Box", fmtInt(challan.totalBoxes)],
    ["Total Cheese", fmtInt(challan.totalCheese)],
    ["Total Gross Wt.", fmtWt3(challan.totalGrossWt)],
    ["Total Less Wt.", fmtWt3(challan.totalTareWt)],
  ];

  const hline = (
    key: string | number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => (
    <div
      key={key}
      style={abs({
        left: `${x}pt`,
        top: `${y - height / 2}pt`,
        width: `${width}pt`,
        height: `${height}pt`,
        background: color,
      })}
    />
  );

  const chipX2 = RIGHT_EDGE - MASTHEAD.chipW;
  const chipX1 = chipX2 - MASTHEAD.chipGap - MASTHEAD.chipW;

  return (
    <div
      className="challan-sheet print-sheet"
      style={{
        position: "relative",
        width: `${SHEET_W}pt`,
        height: `${SHEET_H}pt`,
        overflow: "hidden",
        background: "#fff",
        color: INK,
        margin: "0 auto",
        flexShrink: 0,
      }}
    >
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <div
        style={abs({
          left: `${MARGIN}pt`,
          ...blTop(MASTHEAD.nameBl, nameFontSize),
          ...t(nameFontSize, 700),
        })}
      >
        <Fit w={MASTHEAD.nameMaxW}>{companyName}</Fit>
      </div>
      <div
        style={abs({
          left: `${MARGIN}pt`,
          ...blTop(MASTHEAD.addrBl, MASTHEAD.subSize),
          ...t(MASTHEAD.subSize, 400, LABEL),
        })}
      >
        <Fit w={INFO.dividerX - MARGIN - 24}>{address}</Fit>
      </div>
      {phones && (
        <div
          style={abs({
            left: `${MARGIN}pt`,
            ...blTop(MASTHEAD.contactBl, MASTHEAD.subSize),
            ...t(MASTHEAD.subSize, 400, LABEL),
          })}
        >
          <Fit w={INFO.dividerX - MARGIN - 24}>Contact No.: {phones}</Fit>
        </div>
      )}

      <div
        style={abs({
          left: `${INFO.dividerX + 8}pt`,
          width: `${RIGHT_EDGE - INFO.dividerX - 8}pt`,
          textAlign: "right",
          ...blTop(MASTHEAD.titleBl, titleFontSize),
          ...t(titleFontSize, 700),
        })}
      >
        <Fit w={RIGHT_EDGE - INFO.dividerX - 8}>{titleFor(type)}</Fit>
      </div>

      {["ORIGINAL", "DUPLICATE"].map((label, i) => (
        <div
          key={label}
          style={abs({
            left: `${i === 0 ? chipX1 : chipX2}pt`,
            top: `${MASTHEAD.chipTop}pt`,
            width: `${MASTHEAD.chipW}pt`,
            height: `${MASTHEAD.chipH}pt`,
            border: "0.6pt solid #000",
            borderRadius: `${MASTHEAD.chipH / 2}pt`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <span style={t(MASTHEAD.chipTextSize, 700)}>{label}</span>
        </div>
      ))}

      {hline(
        "masthead-rule",
        MARGIN,
        MASTHEAD.dividerY,
        RIGHT_EDGE - MARGIN,
        MASTHEAD.dividerW,
        INK,
      )}

      {/* ── Info band: party + meta ─────────────────────────────────────── */}
      <div
        style={abs({
          left: `${INFO.dividerX}pt`,
          top: `${INFO.top}pt`,
          width: "0.7pt",
          height: `${INFO.bottom - INFO.top}pt`,
          background: ROWRULE,
        })}
      />

      <div
        style={abs({
          left: `${MARGIN}pt`,
          ...blTop(INFO.labelBl, INFO.labelSize),
          ...t(INFO.labelSize, 700, LABEL),
        })}
      >
        M/S
      </div>
      <div
        style={abs({
          left: `${MARGIN}pt`,
          ...blTop(INFO.nameBl, partyFontSize),
          ...t(partyFontSize, 700),
        })}
      >
        <Fit w={partyNameMax}>{partyName}</Fit>
      </div>
      {partyGstin && (
        <div
          style={abs({
            left: `${MARGIN + partyNameMax + 8}pt`,
            width: `${INFO.gstinRail - MARGIN - partyNameMax - 8}pt`,
            textAlign: "right",
            ...blTop(INFO.nameBl, INFO.gstinSize),
            ...t(INFO.gstinSize, 700),
          })}
        >
          <Fit w="100%">{partyGstin}</Fit>
        </div>
      )}
      <div
        style={abs({
          left: `${MARGIN}pt`,
          right: `${SHEET_W - INFO.dividerX + (partyPhone ? 96 : 8)}pt`,
          ...blTop(INFO.subBl, INFO.subSize),
          ...t(INFO.subSize, 400, LABEL),
        })}
      >
        <Fit w="100%">{partyAddress}</Fit>
      </div>
      {partyPhone && (
        <div
          style={abs({
            right: `${SHEET_W - INFO.dividerX + 8}pt`,
            ...blTop(INFO.subBl, INFO.subSize),
            ...t(INFO.subSize, 400, LABEL),
          })}
        >
          Mobile : {partyPhone}
        </div>
      )}

      <div
        style={abs({
          left: `${INFO.metaX}pt`,
          ...blTop(INFO.metaLabelBl1, INFO.labelSize),
          ...t(INFO.labelSize, 700, LABEL),
        })}
      >
        CHALLAN NO.
      </div>
      <div
        style={abs({
          left: `${INFO.metaX}pt`,
          ...blTop(INFO.metaValueBl1, numberFontSize),
          ...t(numberFontSize, 700),
        })}
      >
        <Fit w={RIGHT_EDGE - INFO.metaX}>{challan.challanNumber}</Fit>
      </div>
      <div
        style={abs({
          left: `${INFO.metaX}pt`,
          ...blTop(INFO.metaLabelBl2, INFO.labelSize),
          ...t(INFO.labelSize, 700, LABEL),
        })}
      >
        DATE
      </div>
      <div
        style={abs({
          left: `${INFO.metaX}pt`,
          ...blTop(INFO.metaValueBl2, dateFontSize),
          ...t(dateFontSize, 700),
        })}
      >
        <Fit w={RIGHT_EDGE - INFO.metaX}>{fmtDate(challan.date)}</Fit>
      </div>

      {/* ── Items table ──────────────────────────────────────────────────── */}
      <div
        style={abs({
          left: `${TABLE.x}pt`,
          top: `${TABLE.headY}pt`,
          width: `${TABLE.w}pt`,
          height: `${TABLE.headH}pt`,
          background: BAND,
        })}
      />
      <div
        style={abs({
          left: `${TABLE.x}pt`,
          top: `${TABLE.headY}pt`,
          width: `${TABLE.w}pt`,
          height: `${TABLE.headH}pt`,
          display: "flex",
        })}
      >
        {COLS.map((col, i) => (
          <div key={col.label} style={cellStyle(col, i)}>
            <Fit
              w={colWidth(i) - (col.pad ?? 0) * 2}
              style={t(7, 700, HEADER_TEXT)}
            >
              {col.label.toUpperCase()}
            </Fit>
          </div>
        ))}
      </div>
      {hline("head-rule", TABLE.x, TABLE.bodyTop, TABLE.w, 0.9, INK)}

      <div
        style={abs({
          left: `${TABLE.x}pt`,
          top: `${TABLE.bodyTop}pt`,
          width: `${TABLE.w}pt`,
          height: `${TABLE.bodyBottom - TABLE.bodyTop}pt`,
        })}
      >
        {Array.from({ length: ROWS_PER_PAGE }).map((_, r) => {
          const item = items[r];
          const values = item
            ? [
                String(pageIndex * ROWS_PER_PAGE + r + 1),
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
          return (
            <div
              key={r}
              style={{
                height: `${ROW_H}pt`,
                display: "flex",
                alignItems: "stretch",
              }}
            >
              {values.map((value, c) => (
                <div key={c} style={cellStyle(COLS[c], c)}>
                  <Fit w={colWidth(c) - (COLS[c].pad ?? 0) * 2} style={t(9)}>
                    {value}
                  </Fit>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {Array.from({ length: ROWS_PER_PAGE - 1 }).map((_, r) =>
        hline(
          `row-rule-${r}`,
          TABLE.x,
          TABLE.bodyTop + (r + 1) * ROW_H,
          TABLE.w,
          0.5,
          ROWRULE,
        ),
      )}
      {hline("body-bottom", TABLE.x, TABLE.bodyBottom, TABLE.w, 0.9, INK)}

      {/* ── Totals zone ──────────────────────────────────────────────────── */}
      <div
        style={abs({
          left: `${TOTALS.leftX}pt`,
          ...blTop(TOTALS.gstinBl, 9),
          ...t(9, 700),
        })}
      >
        <Fit w={INFO.dividerX - TOTALS.leftX - 8}>
          GSTIN :{company?.gstin ? ` ${company.gstin}` : ""}
        </Fit>
      </div>
      <div
        style={abs({
          left: `${TOTALS.leftX}pt`,
          ...blTop(TOTALS.panBl, 9),
          ...t(9, 700),
        })}
      >
        <Fit w={INFO.dividerX - TOTALS.leftX - 8}>
          PAN No. :{company?.pan ? ` ${company.pan}` : ""}
        </Fit>
      </div>
      <div
        style={abs({
          left: `${TOTALS.leftX}pt`,
          right: `${SHEET_W - INFO.dividerX}pt`,
          ...blTop(TOTALS.remarksBl, 9),
          display: "flex",
          alignItems: "baseline",
          gap: "4pt",
        })}
      >
        <span style={{ ...t(9, 700), flexShrink: 0 }}>Remarks :</span>
        <Fit w="100%" style={{ ...t(9, 400, LABEL), minWidth: 0 }}>
          {challan.notes?.trim().toUpperCase() ?? ""}
        </Fit>
      </div>

      {totals.map(([label, value], i) => (
        <div
          key={label}
          style={abs({
            left: `${TOTALS.labelX}pt`,
            width: `${TOTALS.valueR - TOTALS.labelX}pt`,
            ...blTop(TOTALS.baselines[i], 9),
            display: "flex",
            alignItems: "baseline",
          })}
        >
          <span style={{ ...t(9, 400, LABEL), marginRight: "auto" }}>
            {label}
          </span>
          <span style={t(9, 700)}>{value}</span>
        </div>
      ))}
      {hline(
        "totals-rule",
        TOTALS.labelX,
        TOTALS.ruleY,
        TOTALS.valueR - TOTALS.labelX,
        0.7,
        ROWRULE,
      )}
      <div
        style={abs({
          left: `${TOTALS.labelX}pt`,
          width: `${TOTALS.valueR - TOTALS.labelX}pt`,
          ...blTop(TOTALS.finalBl, 9.5),
          display: "flex",
          alignItems: "baseline",
        })}
      >
        <span style={{ ...t(9, 700), marginRight: "auto" }}>
          Total Nett Wt.
        </span>
        <span style={t(9.5, 700)}>{fmtWt3(challan.totalNetWt)}</span>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {hline("footer-rule", TABLE.x, FOOTER.ruleY, TABLE.w, 0.7, INK)}
      <div
        style={abs({
          left: `${FOOTER.termsX}pt`,
          ...blTop(FOOTER.termsTitleBl, FOOTER.termsSize),
          ...t(FOOTER.termsSize, 700),
        })}
      >
        {FOOTER.termsTitle}
      </div>
      {FOOTER.termsItems.map((item) => (
        <div
          key={item.bl}
          style={abs({
            left: `${FOOTER.termsX}pt`,
            ...blTop(item.bl, FOOTER.termsSize - 0.5),
            ...t(FOOTER.termsSize - 0.5, 400, LABEL),
          })}
        >
          {item.text}
        </div>
      ))}

      {hline(
        "receiver-line",
        FOOTER.receiverLineX1,
        FOOTER.signLineY,
        FOOTER.receiverLineX2 - FOOTER.receiverLineX1,
        0.7,
        ROWRULE,
      )}
      <div
        style={abs({
          left: `${FOOTER.receiverLineX1}pt`,
          width: `${FOOTER.receiverLineX2 - FOOTER.receiverLineX1}pt`,
          textAlign: "center",
          ...blTop(FOOTER.signLabelBl, FOOTER.termsSize - 0.5),
          ...t(FOOTER.termsSize - 0.5, 400, LABEL),
        })}
      >
        Receiver&apos;s Sign.
      </div>

      <div
        style={abs({
          left: "420pt",
          width: `${RIGHT_EDGE - 420}pt`,
          textAlign: "right",
          ...blTop(FOOTER.forBl, forFontSize),
          ...t(forFontSize, 700),
        })}
      >
        For {companyName}
      </div>
      {hline(
        "sign-line",
        467,
        FOOTER.signLineY,
        RIGHT_EDGE - 467,
        0.7,
        ROWRULE,
      )}
      <div
        style={abs({
          left: "420pt",
          width: `${RIGHT_EDGE - 420}pt`,
          textAlign: "right",
          ...blTop(FOOTER.authBl, FOOTER.authSize),
          ...t(FOOTER.authSize, 700, LABEL),
        })}
      >
        AUTHORISED SIGNATORY
      </div>

      {pageCount > 1 && (
        <div
          style={abs({
            left: `${MARGIN}pt`,
            width: `${TABLE.w}pt`,
            textAlign: "center",
            ...blTop(FOOTER.pageBl, FOOTER.pageSize),
            ...t(FOOTER.pageSize, 400, FAINT),
          })}
        >
          Page {pageIndex + 1} of {pageCount}
        </div>
      )}
    </div>
  );
}

export function ChallanDocument({
  detail,
  company,
  type,
}: {
  detail: ChallanDetail;
  company: Company | null;
  type: "sales" | "outward";
}) {
  // Re-render once the exact Inter faces are ready so canvas measurement and
  // layout use the embedded font, not a fallback.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      document.fonts.load('400 12px "Inter Print"'),
      document.fonts.load('700 12px "Inter Print"'),
    ]).then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pages: ChallanDetail["items"][] = [];
  for (let i = 0; i < detail.items.length; i += ROWS_PER_PAGE) {
    pages.push(detail.items.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <>
      <InterPrintFaces />
      {pages.map((items, i) => (
        <Sheet
          key={`${i}-${fontsReady}`}
          detail={detail}
          company={company}
          type={type}
          items={items}
          pageIndex={i}
          pageCount={pages.length}
        />
      ))}
    </>
  );
}
