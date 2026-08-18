export function uniqueAnimalIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export function toggleAnimalSelection(current: readonly string[], animalId: string): string[] {
  return current.includes(animalId)
    ? current.filter((id) => id !== animalId)
    : [...current, animalId];
}

export function groupedSaleTotal(
  animalIds: readonly string[],
  weights: Readonly<Record<string, string>>,
  pricePerKg: string,
): number | null {
  const price = Number(pricePerKg);
  if (!Number.isFinite(price) || price <= 0) return null;
  const totalWeight = animalIds.reduce((total, id) => total + (Number(weights[id]) || 0), 0);
  return totalWeight > 0 ? Math.round(totalWeight * price * 100) / 100 : null;
}
