import { differenceInCalendarDays } from "date-fns";

export type StatutPlanningVaccin =
  | "TROP_TOT"
  | "A_PREVOIR"
  | "A_FAIRE"
  | "EN_RETARD_LEGER"
  | "EN_RETARD";

/**
 * Couleurs terrain autour de la fenêtre vaccinale :
 * - bleu : plus de 7 jours avant
 * - jaune : 1 à 7 jours avant
 * - vert : dans la fenêtre
 * - orange : 1 à 3 jours après
 * - rouge : plus de 3 jours après
 */
export function statutPlanningVaccin(
  date: Date,
  dateMin: Date,
  dateMax: Date
): StatutPlanningVaccin {
  const joursAvant = differenceInCalendarDays(dateMin, date);
  if (joursAvant > 0) return joursAvant <= 7 ? "A_PREVOIR" : "TROP_TOT";

  const joursApres = differenceInCalendarDays(date, dateMax);
  if (joursApres <= 0) return "A_FAIRE";
  return joursApres <= 3 ? "EN_RETARD_LEGER" : "EN_RETARD";
}
