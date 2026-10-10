export type StatutAgenda = "EN_RETARD" | "A_FAIRE" | "BIENTOT" | "PREVU";

export interface ActionAgenda {
  animalId: string;
  nutrav: string;
  nom: string | null;
  medicamentId: string | null;
  medicamentNom: string;
  protocoleId: string | null;
  etapeId: string;
  etapeLabel: string;
  typeEtape: "INITIAL" | "ENTRETIEN";
  statut: StatutAgenda;
  dateMin: string;
  dateMax: string;
  dateVelageReference: string | null;
}

export interface GroupeAgenda {
  cle: string;
  statut: StatutAgenda;
  medicamentNom: string;
  etapeLabel: string;
  dateMin: string;
  dateMax: string;
  actions: ActionAgenda[];
}

const ordreStatut: Record<StatutAgenda, number> = {
  EN_RETARD: 0,
  A_FAIRE: 1,
  BIENTOT: 2,
  PREVU: 3,
};

export function formatDateAgenda(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(dateIso));
}

export function libelleFenetreVaccinale(
  statut: StatutAgenda,
  dateMin: string,
  dateMax: string,
): { statut: string; date: string } {
  if (statut === "PREVU") return { statut: "", date: `dès ${formatDateAgenda(dateMin)}` };
  if (statut === "BIENTOT") return { statut: "bientôt", date: `dès ${formatDateAgenda(dateMin)}` };
  if (statut === "A_FAIRE") return { statut: "à faire", date: `jusqu’au ${formatDateAgenda(dateMax)}` };
  return { statut: "en retard", date: `depuis ${formatDateAgenda(dateMax)}` };
}

export function regrouperActionsAgenda(actions: readonly ActionAgenda[]): GroupeAgenda[] {
  const groupes = new Map<string, GroupeAgenda>();
  for (const action of actions) {
    const cle = [action.medicamentId ?? action.medicamentNom, action.etapeId, action.statut, action.dateMin, action.dateMax].join("|");
    const groupe = groupes.get(cle);
    if (groupe) groupe.actions.push(action);
    else groupes.set(cle, {
      cle,
      statut: action.statut,
      medicamentNom: action.medicamentNom,
      etapeLabel: action.etapeLabel,
      dateMin: action.dateMin,
      dateMax: action.dateMax,
      actions: [action],
    });
  }
  return [...groupes.values()].sort((a, b) => {
    const section = ordreStatut[a.statut] - ordreStatut[b.statut];
    if (section !== 0) return section;
    const dateA = new Date(a.statut === "EN_RETARD" || a.statut === "A_FAIRE" ? a.dateMax : a.dateMin).getTime();
    const dateB = new Date(b.statut === "EN_RETARD" || b.statut === "A_FAIRE" ? b.dateMax : b.dateMin).getTime();
    return dateA - dateB || a.medicamentNom.localeCompare(b.medicamentNom, "fr");
  });
}

export function semaineDu(dateIso: string): string {
  const date = new Date(dateIso);
  const jour = date.getDay() || 7;
  date.setDate(date.getDate() - jour + 1);
  return `Semaine du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(date)}`;
}
