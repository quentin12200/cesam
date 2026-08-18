export const SALE_WEIGHT_SOURCES = ["LAST_WEIGHT", "PREDICTED", "MERCHANT", "MANUAL"] as const;
export type SaleWeightSource = (typeof SALE_WEIGHT_SOURCES)[number];

export type SaleSimulationLineInput = {
  animalId: string;
  lastWeight: number | null;
  lastWeightDate: string | null;
  gmq: number | null;
  predictedWeight: number | null;
  merchantWeight: number | null;
  manualWeight: number | null;
  source: SaleWeightSource;
  individualRefaction: number | null;
  individualPriceKg: number | null;
};

export function elapsedWholeDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function predictedWeight(lastWeight: number | null, gmq: number | null, days: number): number | null {
  if (lastWeight === null || gmq === null || !Number.isFinite(gmq) || gmq <= 0 || days <= 0) return null;
  return Math.round((lastWeight + gmq * days) * 10) / 10;
}

export function weightForSource(line: SaleSimulationLineInput): number | null {
  const value = line.source === "LAST_WEIGHT" ? line.lastWeight
    : line.source === "PREDICTED" ? line.predictedWeight
      : line.source === "MERCHANT" ? line.merchantWeight
        : line.manualWeight;
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

export function retainedWeight(weight: number, refaction: number): number {
  const safeRefaction = Math.min(100, Math.max(0, refaction));
  return Math.round(weight * (1 - safeRefaction / 100) * 10) / 10;
}

export function saleLineEstimate(
  line: SaleSimulationLineInput,
  globalRefaction: number,
  globalPriceKg: number,
) {
  const usedWeight = weightForSource(line);
  if (usedWeight === null) return null;
  const refaction = line.individualRefaction ?? globalRefaction;
  const priceKg = line.individualPriceKg ?? globalPriceKg;
  const retained = retainedWeight(usedWeight, refaction);
  return {
    usedWeight,
    retainedWeight: retained,
    priceKg,
    amount: Math.round(retained * priceKg * 100) / 100,
  };
}

export function saleSimulationSummary(lines: SaleSimulationLineInput[], globalRefaction: number, globalPriceKg: number) {
  const estimates = lines.flatMap((line) => {
    const estimate = saleLineEstimate(line, globalRefaction, globalPriceKg);
    return estimate ? [estimate] : [];
  });
  const totalUsedWeight = Math.round(estimates.reduce((sum, item) => sum + item.usedWeight, 0) * 10) / 10;
  const totalRetainedWeight = Math.round(estimates.reduce((sum, item) => sum + item.retainedWeight, 0) * 10) / 10;
  const totalAmount = Math.round(estimates.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  return {
    animalCount: lines.length,
    totalUsedWeight,
    totalRetainedWeight,
    totalAmount,
    averageAmount: lines.length ? Math.round(totalAmount / lines.length * 100) / 100 : 0,
  };
}

export function isSaleWeightSource(value: unknown): value is SaleWeightSource {
  return typeof value === "string" && SALE_WEIGHT_SOURCES.includes(value as SaleWeightSource);
}
