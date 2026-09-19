import type { ChallanType } from "@kataria-syntex/shared";

export type { ChallanType };

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

export type SheetParty = {
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

export type ChallanFonts = { regular: string; bold: string };

export type ChallanHtmlInput = {
  detail: SheetDetail;
  company: SheetCompany | null;
  type: ChallanType;
  fonts: ChallanFonts;
};
