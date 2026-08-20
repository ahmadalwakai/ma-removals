// The authoritative pricing engine lives in the API route
// `src/app/api/pricing/calculate/route.ts` (config-driven via the database).
// This module only exposes shared display helpers used across the booking UI.

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatPrice(n: number): string {
  return GBP.format(n);
}

export function formatPence(pence: number): string {
  return GBP.format(pence / 100);
}
