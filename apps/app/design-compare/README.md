# Design directions — pending owner picks

Finished, verified design directions for the app's printed documents. **The
live templates keep their current presentation until the owner picks a
direction for each.** Nothing here is wired into the app.

Three artifacts; the challan and sticker galleries hold ten directions
each, the report gallery holds ten formats in both orientations:

| Artifact                                        | File                          | Directions                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery challan sheet (A5 landscape)           | `challan-styles-compare.html` | A Refined Classic · B Modern Minimal · C Bold Corporate · D Heritage Ledger · E Editorial Mono · F Ticket Rail · G Carbon Copy · H Swiss Grid · I Soft Rounded · J Framed Certificate              |
| Carton sticker (A4, 6-up, 2 × 3)                | `sticker-styles-compare.html` | S-A Refined Classic · S-B Modern Minimal · S-C Bold Industrial · S-D Centered Vintage · S-E Hero Carton · S-F Split Panel · S-G Dotted Ledger · S-H Corner Tag · S-I Zebra Rows · S-J Ticket Split |
| Sales challan report (A4, portrait + landscape) | `report-styles-compare.html`  | R1 Classic Register · R2 Modern Minimal · R3 Executive KPI · R4 Bold Band · R5 Ledger Ruled · R6 Soft Rounded · R7 Ticket Header · R8 Editorial Mono · R9 Day Groups · R10 Statement               |

## View

Open any file directly in a browser — real-size sheets, Inter inlined (no
network needed). Sticker pages show each full A4 sheet plus one sticker
enlarged 1.5× for detail. The report gallery shows every format in both
orientations back to back.

## Challan sheet directions

|     | Name            | Look                                                                                                         |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| A   | Refined Classic | The current sheet professionally typeset: framed party box, dark table header, soft gray totals panel        |
| B   | Modern Minimal  | Invoice-app clean: no frames, light tinted header pill, zebra rows, accent bar on the party name             |
| C   | Bold Corporate  | Dark masthead band with white company name, GSTIN chip, fine column rules, dark totals panel (white figures) |

All three: grayscale-safe (clean on mono printers; C's dark panel uses more
toner), tabular figures, TARE WT./NET WT. terms, ORIGINAL/DUPLICATE boxes.

## Carton sticker directions

Built from the owner's reference print (6 cartons 1596–1601, lot 246, shade
SRE-101, denier 225 RESAM SILK, party SHRI RAM EMBROIDERY). Every design
uses the reference's exact print geometry: A4, 6-up (2 × 3), 99 × 88.5 mm
stickers, hairline cut guides. Field set: Carton No., Gross/Tare/Net Wt.,
Lot No., Denier + color, Shade, Cheese, party name, don't-mix-lot note.
Standouts for warehouse readability (per labeling best practices — high
contrast, one hero figure): S-E Hero Carton and S-C/S-F dark panels.

## Report formats

Built from the owner's reference (SRE 08082026.pdf — sales challan report,
date–party wise: 11 cartons of challan 267, grand totals 452.440 / 38.960 /
413.480). Each format renders in BOTH A4 orientations with per-orientation
column grids — nothing clips in either. Terms standardized to Tare/Net;
columns: Date, Ch. No., Party, Box No., Lot, Gross/Tare/Net Wt., Denier,
Color, Remarks. R9 Day Groups scales to multi-day reports (date header rows
with per-day subtotals as the natural next step). R3's KPI cards make totals
readable without scanning the table.

## Verified

Every sheet renders at its exact print size in Chromium with zero overflow
(checked headlessly via Electron `capturePage` +
`scrollHeight === clientHeight` per sheet): challan 210 × 148 mm, sticker
sheet 210 × 297 mm with six 99 × 88.5 mm stickers (the reference
print's exact 2 × 3 geometry), and all 20 report sheets (10 formats ×
portrait 210 × 297 mm + landscape 297 × 210 mm).

## On pick

When the owner names a direction per artifact (or a mix, e.g. "challan C but
keep the light totals panel"):

1. Rebuild the matching shared template's presentation in that style —
   geometry, typography and classes only; the data contract and the render
   paths (Browser Run, Electron `printToPDF`, print page) don't move.
2. Re-render sample PDFs through the Electron pipeline and re-verify: exact
   page size, no clipping, single- and multi-page (challan) and full 6-up
   sheets (sticker).
3. Update this folder's status, `design.md` § 2.4.1 and `APP.md` § 12.
4. Delete this folder — the style then lives only in the template.

Note: sticker printing has no pipeline in the app yet; building it is a
separate decision for after the style pick.
