import "server-only";

export function toPaiseFromRupees(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error(`Invalid rupee amount: ${rupees}. Must be a positive finite number.`);
  }
  return Math.round(rupees * 100);
}

export function formatPaiseAsINR(paise: number): string {
  if (!Number.isFinite(paise) || paise < 0) {
    return "₹0";
  }
  const rupees = paise / 100;
  return `₹${Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees)}`;
}

export function formatPaiseAsINRSimple(paise: number): string {
  if (!Number.isFinite(paise) || paise < 0) {
    return "₹0";
  }
  const rupees = paise / 100;
  return `₹${Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees)}`;
}

export function assertValidPaiseAmount(paise: number): void {
  if (!Number.isFinite(paise) || paise < 0 || !Number.isInteger(paise)) {
    throw new Error(`Invalid paise amount: ${paise}. Must be a non-negative integer.`);
  }
}

export function rupeesToDisplay(rupees: number): string {
  if (!Number.isFinite(rupees) || rupees < 0) return "₹0";
  return `₹${Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees)}`;
}
