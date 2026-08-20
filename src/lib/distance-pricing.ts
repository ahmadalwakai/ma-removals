export interface DistanceBandCharge {
  label: string;
  miles: number;
  rate: number;
  amount: number;
}

export interface DistanceFee {
  label: string;
  amount: number;
}

export interface DistanceChargeResult {
  total: number;
  distanceMiles: number;
  freeMiles: number;
  chargeableMiles: number;
  bands: DistanceBandCharge[];
  fees: DistanceFee[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const MARKETPLACE_DISTANCE_AVERAGES = [
  { upper: 2, label: "0-2 miles", averagePrice: 33.52 },
  { upper: 5, label: "2-5 miles", averagePrice: 29.93 },
  { upper: 10, label: "5-10 miles", averagePrice: 33.52 },
  { upper: 20, label: "10-20 miles", averagePrice: 37.71 },
  { upper: 50, label: "20-50 miles", averagePrice: 47.88 },
  { upper: 100, label: "50-100 miles", averagePrice: 67.03 },
  { upper: 200, label: "100-200 miles", averagePrice: 96.36 },
  { upper: Number.POSITIVE_INFINITY, label: "200+ miles", averagePrice: 164.59 },
];

function distanceBand(distanceMiles: number) {
  return MARKETPLACE_DISTANCE_AVERAGES.find((band) => distanceMiles <= band.upper) ?? MARKETPLACE_DISTANCE_AVERAGES[0]!;
}

export function calculateDistanceCharge(
  rawDistanceMiles: number,
  config: Record<string, number>
): DistanceChargeResult {
  void config;

  const distanceMiles = Math.max(
    0,
    Number.isFinite(rawDistanceMiles) ? rawDistanceMiles : 0
  );
  const freeMiles = 2;
  const chargeableMiles = Math.max(0, distanceMiles - freeMiles);
  const baseline = MARKETPLACE_DISTANCE_AVERAGES[0]!.averagePrice;
  const matchedBand = distanceBand(distanceMiles);
  const total = roundMoney(Math.max(0, matchedBand.averagePrice - baseline));
  const bands: DistanceBandCharge[] = total > 0
    ? [{
        label: matchedBand.label,
        miles: roundMoney(distanceMiles),
        rate: distanceMiles > 0 ? roundMoney(total / distanceMiles) : 0,
        amount: total,
      }]
    : [];

  return {
    total,
    distanceMiles: roundMoney(distanceMiles),
    freeMiles,
    chargeableMiles: roundMoney(chargeableMiles),
    bands,
    fees: [],
  };
}
