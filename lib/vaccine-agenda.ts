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

export interface JourCalendrier {
  cle: string;
  date: Date;
  dansMois: boolean;
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
  premiereEtape = false,
): { statut: string; date: string } {
  const libelleStatut = { PREVU: premiereEtape ? "" : "prévu", BIENTOT: "bientôt", A_FAIRE: "à faire", EN_RETARD: "en retard" }[statut];
  if (premiereEtape) {
    return { statut: libelleStatut, date: `${statut === "A_FAIRE" || statut === "EN_RETARD" ? "depuis" : "dès"} ${formatDateAgenda(statut === "EN_RETARD" ? dateMax : dateMin)}` };
  }
  const unique = new Date(dateMin).getTime() === new Date(dateMax).getTime();
  return { statut: libelleStatut, date: unique ? `le ${formatDateAgenda(dateMin)}` : `${formatDateAgenda(dateMin)} → ${formatDateAgenda(dateMax)}` };
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

export function cleJourCalendrier(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * Date de présentation uniquement : une action active/échue reste visible aujourd'hui ;
 * une action future est placée à l'ouverture de sa fenêtre. Le planner reste inchangé.
 */
export function dateAffichageActionAgenda(groupe: GroupeAgenda, aujourdHui: Date): string {
  if (groupe.statut === "A_FAIRE" || groupe.statut === "EN_RETARD") return cleJourCalendrier(aujourdHui);
  return cleJourCalendrier(new Date(groupe.dateMin));
}

export function selectionDepuisGroupeAgenda(groupe: GroupeAgenda): { animalIds: string[]; actes: string[] } {
  return {
    animalIds: [...new Set(groupe.actions.map((action) => action.animalId))],
    actes: groupe.actions.map((action) => `${action.animalId}|${action.etapeId}`),
  };
}

/** Grille mensuelle stable de six semaines, lundi en première colonne. */
export function construireJoursCalendrier(moisAffiche: Date): JourCalendrier[] {
  const premier = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth(), 1, 12);
  const recul = (premier.getDay() + 6) % 7;
  const debut = new Date(premier);
  debut.setDate(premier.getDate() - recul);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(debut);
    date.setDate(debut.getDate() + index);
    return {
      cle: cleJourCalendrier(date),
      date,
      dansMois: date.getMonth() === moisAffiche.getMonth() && date.getFullYear() === moisAffiche.getFullYear(),
    };
  });
}
