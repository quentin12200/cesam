import { addMonths, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";

export type StatutCelluleVaccinale = "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "VIDE";

export interface CelluleVaccinaleTri {
  statut: StatutCelluleVaccinale;
  date: string | null;
}

const rangUrgence: Record<StatutCelluleVaccinale, number> = {
  EN_RETARD: 0,
  BIENTOT: 1,
  A_FAIRE: 2,
  FAIT: 3,
  VIDE: 4,
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
