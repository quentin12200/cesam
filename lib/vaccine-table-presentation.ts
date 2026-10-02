import { addMonths, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";

export type StatutCelluleVaccinale = "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU" | "VIDE";

export interface CelluleVaccinaleTri {
  statut: StatutCelluleVaccinale;
  date: string | null;
}

// En retard, à faire maintenant, bientôt, puis prévu plus tard (par date croissante), enfin sans échéance.
const rangUrgence: Record<StatutCelluleVaccinale, number> = {
  EN_RETARD: 0,
  A_FAIRE: 1,
  BIENTOT: 2,
  PREVU: 3,
  FAIT: 4,
  VIDE: 5,
};

export function comparerUrgenceVaccinale(a?: CelluleVaccinaleTri, b?: CelluleVaccinaleTri): number {
  const rangA = a ? rangUrgence[a.statut] : rangUrgence.VIDE;
  const rangB = b ? rangUrgence[b.statut] : rangUrgence.VIDE;
  if (rangA !== rangB) return rangA - rangB;

  const dateA = a?.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
  const dateB = b?.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
  return dateA - dateB;
}

export function formatTempsAvantVelage(dateVelagePrevue: string | Date, dateReference = new Date()): string {
  const velage = typeof dateVelagePrevue === "string" ? new Date(dateVelagePrevue) : dateVelagePrevue;
  const jours = differenceInCalendarDays(velage, dateReference);
  if (jours < 0) return `J+${Math.abs(jours)}`;
  if (jours < 30) return `J-${jours}`;

  const mois = Math.max(1, differenceInCalendarMonths(velage, dateReference));
  const joursRestants = Math.max(0, differenceInCalendarDays(velage, addMonths(dateReference, mois)));
  return joursRestants > 0 ? `${mois} m ${joursRestants} j` : `${mois} m`;
}

const VOIES_COURTES: Record<string, string> = {
  IM: "IM", INTRAMUSCULAIRE: "IM", "INTRA-MUSCULAIRE": "IM",
  SC: "SC", "SOUS-CUTANÉE": "SC", "SOUS-CUTANEE": "SC", "SOUS CUTANÉE": "SC", "SOUS CUTANEE": "SC", SOUSCUTANEE: "SC", SOUSCUTANÉE: "SC",
  IN: "IN", NASAL: "IN", NASALE: "IN", INTRANASAL: "IN", INTRANASALE: "IN", "INTRA-NASAL": "IN",
  IV: "IV", INTRAVEINEUSE: "IV", PO: "PO", ORAL: "PO", ORALE: "PO",
};

/** Code de voie court (IM / SC / IN…), ou null si la voie n'est pas renseignée. */
export function voieCourte(voie: string | null | undefined): string | null {
  const brute = voie?.trim();
  if (!brute || /^à renseigner$/i.test(brute)) return null;
  const cle = brute.toLocaleUpperCase("fr");
  return VOIES_COURTES[cle] ?? cle;
}

/** « IM · 2 ml », « IN · dose ? » ou « voie ? · 2 ml » : l'absence d'information reste visible. */
export function libelleVoieDose(voie: string | null | undefined, dose: number | null | undefined, unite: string | null | undefined): string {
  const partieDose = dose == null ? "dose ?" : `${String(dose).replace(".", ",")}${unite?.trim() ? ` ${unite.trim()}` : ""}`;
  return `${voieCourte(voie) ?? "voie ?"} · ${partieDose}`;
}