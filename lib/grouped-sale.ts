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

// Injection de transaction pour tests sans base : le verrou doit être acquis avant la création.
export async function claimAnimalForExit(
  id: string,
  updateMany: (args: { where: { id: string; statut: string }; data: { statut: string; updatedAt: Date } }) => Promise<{ count: number }>,
): Promise<void> {
  const result = await updateMany({ where: { id, statut: "ACTIF" }, data: { statut: "SORTI", updatedAt: new Date() } });
  if (result.count !== 1) throw new Error("ANIMAL_DEJA_SORTI");
}

// Une annulation ne réactive l'animal que lorsqu'il ne reste aucune sortie.
export async function undoExitInTransaction(
  id: string,
  animalId: string,
  tx: {
    sortie: { delete: (args: { where: { id: string } }) => Promise<unknown>; count: (args: { where: { animalId: string } }) => Promise<number> };
    animal: { update: (args: { where: { id: string }; data: { statut: string; updatedAt: Date } }) => Promise<unknown> };
  },
): Promise<boolean> {
  await tx.sortie.delete({ where: { id } });
  const remaining = await tx.sortie.count({ where: { animalId } });
  if (remaining !== 0) return false;
  await tx.animal.update({ where: { id: animalId }, data: { statut: "ACTIF", updatedAt: new Date() } });
  return true;
}
