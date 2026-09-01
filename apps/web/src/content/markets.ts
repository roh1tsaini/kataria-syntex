/** Export destinations and domestic textile hubs served from Surat. */
export interface ExportCountry {
  name: string;
  code: string;
  volume: "high" | "medium" | "low";
}

export const exportCountries: ExportCountry[] = [
  { name: "Bangladesh", code: "BD", volume: "high" },
  { name: "United States", code: "US", volume: "high" },
  { name: "China", code: "CN", volume: "high" },
  { name: "Turkey", code: "TR", volume: "high" },
  { name: "Vietnam", code: "VN", volume: "high" },
  { name: "United Arab Emirates", code: "AE", volume: "high" },
  { name: "Egypt", code: "EG", volume: "medium" },
  { name: "Brazil", code: "BR", volume: "medium" },
  { name: "Germany", code: "DE", volume: "medium" },
  { name: "United Kingdom", code: "GB", volume: "medium" },
  { name: "Italy", code: "IT", volume: "medium" },
  { name: "Pakistan", code: "PK", volume: "medium" },
  { name: "Sri Lanka", code: "LK", volume: "medium" },
  { name: "South Korea", code: "KR", volume: "medium" },
  { name: "Japan", code: "JP", volume: "medium" },
  { name: "Nigeria", code: "NG", volume: "low" },
  { name: "Kenya", code: "KE", volume: "low" },
  { name: "South Africa", code: "ZA", volume: "low" },
  { name: "Australia", code: "AU", volume: "low" },
  { name: "Canada", code: "CA", volume: "low" },
];

export const indianStates = [
  { name: "Gujarat", demand: "high" },
  { name: "Maharashtra", demand: "high" },
  { name: "Tamil Nadu", demand: "high" },
  { name: "Karnataka", demand: "high" },
  { name: "Rajasthan", demand: "high" },
  { name: "Uttar Pradesh", demand: "high" },
  { name: "Punjab", demand: "medium" },
  { name: "Haryana", demand: "medium" },
  { name: "West Bengal", demand: "medium" },
  { name: "Andhra Pradesh", demand: "medium" },
  { name: "Telangana", demand: "medium" },
  { name: "Madhya Pradesh", demand: "medium" },
  { name: "Delhi NCR", demand: "medium" },
  { name: "Kerala", demand: "low" },
  { name: "Odisha", demand: "low" },
] as const;
