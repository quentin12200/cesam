export type PeriodeImpression = "mois" | "annee" | "periode" | "selection";
export type ChoixImpression = { mode: PeriodeImpression; annee: number; mois: number | null; du?: string; au?: string };
const estDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const cleJour = (date: Date) => date.toISOString().slice(0, 10);

/** Filtrage de l'édition uniquement : aucune suppression ni mutation d'archives. */
export function dansImpression(date: Date, choix: ChoixImpression): boolean {
  if (choix.mode === "selection") return true; // La sélection des actes est calculée séparément.
  if (choix.mode === "periode") {
    if (!estDate(choix.du) || !estDate(choix.au) || choix.du! > choix.au!) return false;
    return cleJour(date) >= choix.du! && cleJour(date) <= choix.au!;
  }
  if (date.getUTCFullYear() !== choix.annee) return false;
  return choix.mode === "annee" || (choix.mois !== null && date.getUTCMonth() + 1 === choix.mois);
}
export function periodeValide(choix: ChoixImpression): boolean {
  return choix.mode !== "periode" || Boolean(estDate(choix.du) && estDate(choix.au) && choix.du! <= choix.au!);
}
