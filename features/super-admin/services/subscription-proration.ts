export type ProrationInput = {
  currentPrice: number;
  newPrice: number;
  billingPeriod: "monthly" | "annual";
  daysRemainingInPeriod: number;
};

export type ProrationResult = {
  credit: number;
  charge: number;
  netCharge: number;
  daysInPeriod: number;
};

export function getDaysInPeriod(period: ProrationInput["billingPeriod"]): number {
  switch (period) {
    case "monthly": return 30;
    case "annual": return 365;
  }
}

export function prorate(input: ProrationInput): ProrationResult {
  const daysInPeriod = getDaysInPeriod(input.billingPeriod);
  const daysUsed = Math.max(0, daysInPeriod - input.daysRemainingInPeriod);

  const dailyCurrentRate = daysInPeriod > 0 ? input.currentPrice / daysInPeriod : 0;
  const dailyNewRate = daysInPeriod > 0 ? input.newPrice / daysInPeriod : 0;

  const credit = Math.round(dailyCurrentRate * input.daysRemainingInPeriod);
  const chargeForRemaining = Math.round(dailyNewRate * input.daysRemainingInPeriod);
  const netCharge = Math.max(0, chargeForRemaining - credit);

  return { credit, charge: chargeForRemaining, netCharge, daysInPeriod };
}

export function formatProrationSummary(result: ProrationResult): string {
  const parts: string[] = [];
  if (result.credit > 0) parts.push(`Credit: ${formatPrice(result.credit)}`);
  if (result.charge > 0) parts.push(`Charge: ${formatPrice(result.charge)}`);
  parts.push(`Net: ${formatPrice(result.netCharge)}`);
  return parts.join(" · ");
}

function formatPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
