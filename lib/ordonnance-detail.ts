export type OrdonnanceMedicationSource<TRow, TMedication> =
  | { kind: "relation"; ordonnanceId: string; row: TRow; medication: TMedication }
  | { kind: "legacy"; ordonnanceId: string; row: TRow; medication: null };

export function ordonnanceMedicationSources<
  TRow extends { id: string; medicamentNom: string; medicaments: readonly unknown[] },
>(rows: readonly TRow[]): Array<OrdonnanceMedicationSource<TRow, TRow["medicaments"][number]>> {
  type TMedication = TRow["medicaments"][number];
  const complete = [...rows].sort((left, right) => right.medicaments.length - left.medicaments.length)[0];
  if (complete && complete.medicaments.length > 1) {
    return complete.medicaments.map((medication: TMedication) => ({
      kind: "relation" as const,
      ordonnanceId: complete.id,
      row: complete,
      medication,
    }));
  }

  const sources: Array<OrdonnanceMedicationSource<TRow, TMedication>> = [];
  for (const row of rows) {
    if (row.medicaments.length > 0) {
      for (const medication of row.medicaments as readonly TMedication[]) {
        sources.push({ kind: "relation", ordonnanceId: row.id, row, medication });
      }
    } else if (row.medicamentNom.trim()) {
      sources.push({ kind: "legacy", ordonnanceId: row.id, row, medication: null });
    }
  }
  return sources;
}
