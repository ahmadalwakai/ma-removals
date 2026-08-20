export const ROUNDING_STRATEGY = {
  CEIL_TO_INCREMENT: 0,
  NEAREST_POUND: 1,
  ROUND_DOWN_POUND: 2,
  END_IN_9: 3,
  END_IN_5: 4,
  NONE: 5,
} as const;

interface RoundingInput {
  valuePence: number;
  minimumPence: number;
  incrementPence: number;
  strategy?: number | null;
}

function ceilToIncrement(valuePence: number, incrementPence: number): number {
  const increment = Math.max(1, Math.round(incrementPence));
  return Math.ceil(valuePence / increment) * increment;
}

function protectMinimum(candidatePence: number, minimumPence: number, incrementPence: number): number {
  if (candidatePence >= minimumPence) return candidatePence;
  return ceilToIncrement(minimumPence, incrementPence);
}

function lowerWholePoundsEndingIn9(valuePence: number): number {
  const pounds = Math.floor(valuePence / 100);
  const remainder = pounds % 10;
  const candidatePounds = remainder >= 9
    ? pounds - remainder + 9
    : pounds - remainder - 1;
  return Math.max(0, candidatePounds * 100);
}

function lowerWholePoundsEndingIn5(valuePence: number): number {
  const pounds = Math.floor(valuePence / 100);
  const remainder = pounds % 10;
  const candidatePounds = remainder >= 5
    ? pounds - remainder + 5
    : pounds - remainder - 5;
  return Math.max(0, candidatePounds * 100);
}

export function applyCustomerRounding(input: RoundingInput): number {
  const valuePence = Math.max(Math.round(input.valuePence), input.minimumPence);
  const strategy = input.strategy ?? ROUNDING_STRATEGY.CEIL_TO_INCREMENT;

  if (strategy === ROUNDING_STRATEGY.NONE) return valuePence;
  if (strategy === ROUNDING_STRATEGY.NEAREST_POUND) {
    return protectMinimum(Math.round(valuePence / 100) * 100, input.minimumPence, 100);
  }
  if (strategy === ROUNDING_STRATEGY.ROUND_DOWN_POUND) {
    return protectMinimum(Math.floor(valuePence / 100) * 100, input.minimumPence, 100);
  }
  if (strategy === ROUNDING_STRATEGY.END_IN_9) {
    return protectMinimum(lowerWholePoundsEndingIn9(valuePence), input.minimumPence, input.incrementPence);
  }
  if (strategy === ROUNDING_STRATEGY.END_IN_5) {
    return protectMinimum(lowerWholePoundsEndingIn5(valuePence), input.minimumPence, input.incrementPence);
  }

  return ceilToIncrement(valuePence, input.incrementPence);
}
