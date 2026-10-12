import type { ActeVaccination } from "./vaccine-acts.ts";

export interface LigneHistoriqueVaccinalSante {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  date: Date;
  medicament: string;
  etape: string;
  voie: string | null;
  dose: number | null;
  unite: string | null;
}

/**
 * Présentation Santé fondée exclusivement sur des actes réels datés déjà unifiés.
 * Un statut de protocole ne peut donc jamais devenir une ligne d'historique.
 */
export function construireHistoriqueVaccinalSante(
  actes: readonly ActeVaccination[],
): LigneHistoriqueVaccinalSante[] {
  return actes
    .filter((acte) => acte.statut === "FAIT")
    .map((acte) => ({
      sourceType: acte.sourceType ?? "VACCINATION",
      sourceId: acte.sourceId ?? null,
      date: acte.date,
      medicament: acte.vaccin,
      etape: acte.etapeLabel?.trim() || "Injection",
      voie: acte.voie?.trim() || null,
      dose: acte.dose ?? null,
      unite: acte.uniteDosage?.trim() || null,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
