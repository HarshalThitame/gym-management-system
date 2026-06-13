const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_PATTERN.test(gstin);
}

export function parseGstin(gstin: string): {
  stateCode: string;
  pan: string;
  entityCode: string;
  checkDigit: string;
} | null {
  if (!isValidGstinFormat(gstin)) return null;
  return {
    stateCode: gstin.slice(0, 2),
    pan: gstin.slice(2, 12),
    entityCode: gstin.slice(12, 14),
    checkDigit: gstin.slice(14),
  };
}

const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
  "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh",
};

export function getStateName(stateCode: string): string | null {
  return STATE_CODES[stateCode] ?? null;
}

export function getGstTaxSlab(amount: number, hsnCode?: string): {
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
} {
  if (amount <= 0) return { gstRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0 };

  if (hsnCode) {
    const hsnPrefix = hsnCode.slice(0, 2);
    const slabs: Record<string, number> = {
      "01": 0, "02": 5, "03": 5, "04": 5, "05": 12,
      "06": 12, "07": 12, "08": 18, "09": 18, "10": 18,
      "11": 18, "12": 18, "13": 18, "14": 18, "15": 28,
      "16": 28, "17": 28, "18": 28, "19": 28, "20": 28,
    };
    const gstRate = slabs[hsnPrefix] ?? 18;
    const halfRate = gstRate / 2;
    return { gstRate, cgstRate: halfRate, sgstRate: halfRate, igstRate: gstRate };
  }

  const defaultGst = 18;
  return { gstRate: defaultGst, cgstRate: 9, sgstRate: 9, igstRate: defaultGst };
}
