import { selectionnerVersionsMedicaments, type MedicationSelectionCandidate } from "./ordonnance-medication-selection.ts";

export type OrdonnanceMedicationSource<TRow, TMedication> =
  | { kind: "relation"; ordonnanceId: string; row: TRow; medication: TMedication }
  | { kind: "legacy"; ordonnanceId: string; row: TRow; medication: null };

export function ordonnanceMedicationSources<
  TRow extends {
    id: string;
    medicamentNom: string;
    medicamentId?: string | null;
    conditionnement?: string | null;
    medicaments: readonly MedicationSelectionCandidate[];
  },
>(rows: readonly TRow[]): Array<OrdonnanceMedicationSource<TRow, TRow["medicaments"][number]>> {
  type TMedication = TRow["medicaments"][number];
  type Source = OrdonnanceMedicationSource<TRow, TMedication>;
  const sources: Source[] = [];
  for (const row of rows) {
    if (row.medicaments.length > 0) {
      for (const medication of row.medicaments as readonly TMedication[]) {
        sources.push({ kind: "relation", ordonnanceId: row.id, row, medication });
      }
    } else if (row.medicamentNom.trim()) {
      sources.push({ kind: "legacy", ordonnanceId: row.id, row, medication: null });
    }
  }
  const candidates = sources.map((source) => ({
    source,
    nomExtrait: source.kind === "relation" ? source.medication.nomExtrait : source.row.medicamentNom,
    conditionnement: source.kind === "relation" ? source.medication.conditionnement : source.row.conditionnement,
    evidenceJson: source.kind === "relation" ? source.medication.evidenceJson : null,
    medicamentId: source.kind === "relation" ? source.medication.medicamentId : source.row.medicamentId,
  }));
  return selectionnerVersionsMedicaments(candidates).map(({ source }) => source);
}
