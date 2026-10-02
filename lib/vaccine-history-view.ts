/**
 * Présentation de l'historique vaccinal : filtre d'années, dates compactes d'une cellule et
 * sélection des actes d'un vaccin pour un animal. Tout ceci est de l'AFFICHAGE : le planner
 * (lib/vaccine-grid.ts) calcule toujours à partir de l'historique complet.
 */

export interface ActeHistorique {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  /** Date ISO (acte réel). */
  date: string;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
  gestationId: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
}

export const anneeDeDate = (iso: string): number => new Date(iso).getFullYear();

/** Années réellement présentes dans l'historique + année actuelle, de la plus récente à la plus ancienne. */
export function anneesDisponibles(datesIso: readonly string[], anneeCourante: number): number[] {
  const annees = new Set<number>([anneeCourante]);
  for (const date of datesIso) annees.add(anneeDeDate(date));
  return [...annees].sort((a, b) => b - a);
}

/** `null` = tout l'historique. Filtre d'affichage uniquement. */
export function filtrerParAnnees<T extends { date: string }>(actes: readonly T[], annees: ReadonlySet<number> | null): T[] {
  return annees === null ? [...actes] : actes.filter((acte) => annees.has(anneeDeDate(acte.date)));
}

const jourMois = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const jourMoisAn = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/**
 * Dates affichées dans une cellule (actes triés par date croissante) : les `max` plus récentes
 * parmi les années affichées, puis le nombre restant (« +2 »). L'année n'est écrite que si elle
 * est ambiguë (plusieurs années affichées ou tout l'historique).
 */
export function datesCompactes(
  actes: readonly { date: string }[],
  annees: ReadonlySet<number> | null,
  max = 2,
): { libelles: string[]; reste: number; total: number } {
  const retenus = filtrerParAnnees(actes, annees).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const anneeEvidente = annees !== null && annees.size === 1;
  const format = anneeEvidente ? jourMois : jourMoisAn;
  const visibles = retenus.slice(Math.max(0, retenus.length - max));
  return { libelles: visibles.map((acte) => format.format(new Date(acte.date))), reste: retenus.length - visibles.length, total: retenus.length };
}

const normaliser = (valeur: string) => valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr");

/**
 * Tous les actes réels (Vaccination + Traitement déjà unifiés) d'un vaccin pour un animal :
 * même médicament que le bloc, ou rattachés à son protocole, ou même nom. Triés par date.
 */
export function actesDuVaccin<T extends ActeHistorique>(
  actes: readonly T[],
  bloc: { nom: string; medicamentIds: readonly string[]; protocoleId: string | null },
): T[] {
  const medicaments = new Set(bloc.medicamentIds);
  const nom = normaliser(bloc.nom);
  return actes
    .filter((acte) =>
      (acte.medicamentId != null && medicaments.has(acte.medicamentId))
      || (bloc.protocoleId != null && acte.protocoleId === bloc.protocoleId)
      || normaliser(acte.vaccin) === nom)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
