import { addMonths, addYears, differenceInCalendarDays, differenceInMonths, differenceInYears } from "date-fns";

export function formatAgeTerrain(dateNaissance: Date | string, dateReference = new Date()): string {
  const naissance = typeof dateNaissance === "string" ? new Date(dateNaissance) : dateNaissance;
  const jours = Math.max(0, differenceInCalendarDays(dateReference, naissance));

  if (jours < 30) return `${jours} j`;

  const annees = differenceInYears(dateReference, naissance);
  if (annees >= 1) {
    const mois = Math.max(0, differenceInMonths(dateReference, addYears(naissance, annees)));
    return mois > 0 ? `${annees} a ${mois} m` : `${annees} a`;
  }

  const mois = Math.max(1, differenceInMonths(dateReference, naissance));
  const joursRestants = Math.max(0, differenceInCalendarDays(dateReference, addMonths(naissance, mois)));
  return joursRestants > 0 ? `${mois} m ${joursRestants} j` : `${mois} m`;
}
