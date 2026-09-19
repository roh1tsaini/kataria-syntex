import { describe, expect, it } from "bun:test";
import {
  buildChallanHtml,
  buildChallanSheets,
  type ChallanHtmlInput,
} from "./challan-html";

const mockFonts = {
  regular: "AAEAAAASAQA...TEST_REGULAR_FONT_BASE64...",
  bold: "AAEAAAASAQA...TEST_BOLD_FONT_BASE64...",
};

const mockCompany = {
  name: "Kataria Syntex Private Limited",
  gstin: "24AAACK1234F1Z5",
  pan: "AAACK1234F",
  address: "Plot 12-14, GIDC Industrial Estate, Surat, Gujarat - 395006",
  phone1: "9876543210",
  phone2: "9876543211",
};

const mockSalesInput: ChallanHtmlInput = {
  type: "sales",
  company: mockCompany,
  fonts: mockFonts,
  detail: {
    challan: {
      challanNumber: "DC-2627-0042",
      date: "2026-09-19",
      customerGstin: "24AABCS5678G1Z1",
      notes: "Urgent delivery by tempo. Handover to supervisor.",
      totalBoxes: 2,
      totalCheese: 48,
      totalGrossWt: 105.45,
      totalTareWt: 5.45,
      totalNetWt: 100.0,
    },
    customer: {
      name: "Surat Textiles Pvt Ltd",
      address: "Ring Road, Surat, Gujarat",
      phone: "9123456780",
    },
    jobWorker: null,
    items: [
      {
        boxNo: "B-101",
        lotNo: "L-901",
        cheese: 24,
        grossWt: 52.75,
        tareWt: 2.75,
        netWt: 50.0,
        denierName: "80/72 SD",
        colorName: "Jet Black",
      },
      {
        boxNo: "B-102",
        lotNo: "L-902",
        cheese: 24,
        grossWt: 52.7,
        tareWt: 2.7,
        netWt: 50.0,
        denierName: "80/72 SD",
        colorName: "Optical White",
      },
    ],
  },
};

const mockOutwardInput: ChallanHtmlInput = {
  type: "outward",
  company: mockCompany,
  fonts: mockFonts,
  detail: {
    challan: {
      challanNumber: "JW-2627-0015",
      date: "2026-09-19",
      customerGstin: null,
      notes: "Job work process: Yarn Dyeing",
      totalBoxes: 1,
      totalCheese: 24,
      totalGrossWt: 52.5,
      totalTareWt: 2.5,
      totalNetWt: 50.0,
    },
    customer: null,
    jobWorker: {
      name: "Apex Dyeing & Printing Mills",
      address: "Pandesara GIDC, Surat",
      phone: "9825123456",
    },
    items: [
      {
        boxNo: "JW-01",
        lotNo: "LOT-X",
        cheese: 24,
        grossWt: 52.5,
        tareWt: 2.5,
        netWt: 50.0,
        denierName: "150/48 Bright",
        colorName: "Raw White",
      },
    ],
  },
};

describe("challan-html", () => {
  it("generates byte-exact standalone HTML for sales challan", () => {
    const html = buildChallanHtml(mockSalesInput);
    expect(html).toMatchSnapshot();
  });

  it("generates byte-exact standalone HTML for outward job work challan", () => {
    const html = buildChallanHtml(mockOutwardInput);
    expect(html).toMatchSnapshot();
  });

  it("generates matching sheets and CSS", () => {
    const sheets = buildChallanSheets(mockSalesInput);
    expect(sheets.css).toContain("Inter Print");
    expect(sheets.body).toContain("DC-2627-0042");
    expect(sheets.body).toContain("SURAT TEXTILES PVT LTD");
    expect(sheets.body).toContain("DELIVERY CHALLAN");
  });
});
