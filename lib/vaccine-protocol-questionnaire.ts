import { addDays, addMonths, differenceInCalendarDays, endOfMonth, subDays } from "date-fns";

export type UniteDureeQuestionnaire = "JOUR" | "SEMAINE" | "MOIS";
export type DureeQuestionnaire = { valeur: number; unite: UniteDureeQuestionnaire };

export type RegleTemporelleQuestionnaire =
  | { type: "SANS_REGLE" }
  | { type: "AGE_MINIMUM"; age: DureeQuestionnaire }
  | { type: "AVANT_VELAGE"; debutAvant: DureeQuestionnaire; finAvant: DureeQuestionnaire }
  | { type: "MOIS_ANNUELS"; mois: number[] };

export interface BrancheAgePrimoQuestionnaire {
  id: string;
  position: "AVANT_SEUIL" | "A_PARTIR_SEUIL";
  preconisationPrimoId: string;
  delaiRappel: DureeQuestionnaire;
  preconisationRappelId: string;
}

export interface ConfigurationQuestionnaireV1 {
  version: 1;
  medicamentId: string;
  /** Limite facultative propre au programme d'élevage : uniquement pour démarrer, pas pour un rappel après Primo. */
  ageMaxDemarrage?: DureeQuestionnaire | null;
  cible: {
    tousBovins: boolean;
    categories: string[];
  };
  demarrage:
    | {
        type: "DOSE_UNIQUE";
        etapeDoseId: string;
        preconisationId: string;
        calendrier: RegleTemporelleQuestionnaire;
      }
    | {
        type: "PRIMO_RAPPEL";
        etapePrimoId: string;
        etapeRappelId: string;
        calendrierPrimo: RegleTemporelleQuestionnaire;
        rappel:
          | {
              type: "DELAI_FIXE";
              delai: DureeQuestionnaire;
              preconisationPrimoId: string;
              preconisationRappelId: string;
              resterDansFenetrePrimo: boolean;
            }
          | {
              type: "BRANCHES_AGE_PRIMO";
              seuilAgePrimo: DureeQuestionnaire;
              branches: BrancheAgePrimoQuestionnaire[];
              resterDansFenetrePrimo: boolean;
            };
      };
  entretien:
    | { actif: false }
    | {
        actif: true;
        etapeId: string;
        preconisationId: string;
        calendrier:
          | { type: "APRES_DELAI"; premierDelai: DureeQuestionnaire; recurrence: DureeQuestionnaire }
          | { type: "AVANT_VELAGE"; debutAvant: DureeQuestionnaire; finAvant: DureeQuestionnaire }
          | { type: "MOIS_ANNUELS"; mois: number[] };
      };
}

const UNITES = new Set<UniteDureeQuestionnaire>(["JOUR", "SEMAINE", "MOIS"]);
const moisValides = (mois: unknown): mois is number[] => Array.isArray(mois)
  && mois.length > 0
  && mois.every((value) => Number.isInteger(value) && value >= 1 && value <= 12)
  && new Set(mois).size === mois.length;

export function dureeQuestionnaireValide(duree: unknown, autoriserDecimal = false): duree is DureeQuestionnaire {
  if (!duree || typeof duree !== "object") return false;
  const value = duree as DureeQuestionnaire;
  return UNITES.has(value.unite)
    && Number.isFinite(value.valeur)
    && value.valeur >= 0
    && (autoriserDecimal || Number.isInteger(value.valeur));
}

export function preconisationAutomatique(preconisations: ReadonlyArray<{ id: string }>): string | null {
  return preconisations.length === 1 ? preconisations[0].id : null;
}

function regleTemporelleValide(regle: unknown): regle is RegleTemporelleQuestionnaire {
  if (!regle || typeof regle !== "object") return false;
  const value = regle as RegleTemporelleQuestionnaire;
  if (value.type === "SANS_REGLE") return true;
  if (value.type === "AGE_MINIMUM") return dureeQuestionnaireValide(value.age, true);
  if (value.type === "AVANT_VELAGE") return dureeQuestionnaireValide(value.debutAvant, true) && dureeQuestionnaireValide(value.finAvant, true);
  return value.type === "MOIS_ANNUELS" && moisValides(value.mois);
}

function texteNonVide(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Parse la seule version comprise par le moteur. Un JSON inconnu n'est jamais interprété partiellement. */
export function lireConfigurationQuestionnaire(json: string | null | undefined): ConfigurationQuestionnaireV1 | null {
  if (!json) return null;
  let value: ConfigurationQuestionnaireV1;
  try { value = JSON.parse(json) as ConfigurationQuestionnaireV1; } catch { return null; }
  if (value.version !== 1 || !texteNonVide(value.medicamentId) || !value.cible || !value.demarrage || !value.entretien) return null;
  if (!Array.isArray(value.cible.categories)) return null;
  // Les anciens questionnaires v1 sans limite sont conservés tels quels.
  if (value.ageMaxDemarrage != null && !dureeQuestionnaireValide(value.ageMaxDemarrage)) return null;
  if (value.ageMaxDemarrage != null) {
    const calendrier = value.demarrage.type === "DOSE_UNIQUE" ? value.demarrage.calendrier : value.demarrage.type === "PRIMO_RAPPEL" ? value.demarrage.calendrierPrimo : null;
    if (!calendrier || (calendrier.type !== "AGE_MINIMUM" && calendrier.type !== "SANS_REGLE")) return null;
    if (calendrier.type === "AGE_MINIMUM" && dureeQuestionnaireEnJours(value.ageMaxDemarrage) < dureeQuestionnaireEnJours(calendrier.age)) return null;
  }
  if (value.demarrage.type === "DOSE_UNIQUE") {
    if (!texteNonVide(value.demarrage.etapeDoseId) || !texteNonVide(value.demarrage.preconisationId) || !regleTemporelleValide(value.demarrage.calendrier)) return null;
  } else if (value.demarrage.type === "PRIMO_RAPPEL") {
    if (!texteNonVide(value.demarrage.etapePrimoId) || !texteNonVide(value.demarrage.etapeRappelId) || !regleTemporelleValide(value.demarrage.calendrierPrimo)) return null;
    const rappel = value.demarrage.rappel;
    if (rappel.type === "DELAI_FIXE") {
      if (!dureeQuestionnaireValide(rappel.delai, true) || !texteNonVide(rappel.preconisationPrimoId) || !texteNonVide(rappel.preconisationRappelId)) return null;
    } else if (rappel.type === "BRANCHES_AGE_PRIMO") {
      if (!dureeQuestionnaireValide(rappel.seuilAgePrimo, true) || !Array.isArray(rappel.branches) || rappel.branches.length !== 2) return null;
      if (new Set(rappel.branches.map((branche) => branche.id)).size !== rappel.branches.length) return null;
      if (!rappel.branches.every((branche) => texteNonVide(branche.id)
        && ["AVANT_SEUIL", "A_PARTIR_SEUIL"].includes(branche.position)
        && texteNonVide(branche.preconisationPrimoId)
        && texteNonVide(branche.preconisationRappelId)
        && dureeQuestionnaireValide(branche.delaiRappel, true))) return null;
    } else return null;
  } else return null;
  if (value.entretien.actif) {
    if (!texteNonVide(value.entretien.etapeId) || !texteNonVide(value.entretien.preconisationId)) return null;
    const calendrier = value.entretien.calendrier;
    if (calendrier.type === "APRES_DELAI") {
      if (!dureeQuestionnaireValide(calendrier.premierDelai, true) || !dureeQuestionnaireValide(calendrier.recurrence, true)) return null;
    } else if (calendrier.type === "AVANT_VELAGE") {
      if (!dureeQuestionnaireValide(calendrier.debutAvant, true) || !dureeQuestionnaireValide(calendrier.finAvant, true)) return null;
    } else if (calendrier.type === "MOIS_ANNUELS") {
      if (!moisValides(calendrier.mois)) return null;
    } else return null;
  }
  return value;
}

export function configurationQuestionnaireLieeAuVelage(configuration: ConfigurationQuestionnaireV1): boolean {
  const initiale = configuration.demarrage.type === "DOSE_UNIQUE" ? configuration.demarrage.calendrier : configuration.demarrage.calendrierPrimo;
  return initiale.type === "AVANT_VELAGE" || (configuration.entretien.actif && configuration.entretien.calendrier.type === "AVANT_VELAGE");
}

export function etapeIdsConfigurationQuestionnaire(configuration: ConfigurationQuestionnaireV1): string[] {
  const ids = configuration.demarrage.type === "DOSE_UNIQUE"
    ? [configuration.demarrage.etapeDoseId]
    : [configuration.demarrage.etapePrimoId, configuration.demarrage.etapeRappelId];
  if (configuration.entretien.actif) ids.push(configuration.entretien.etapeId);
  return ids;
}

/** Les mois suivent le calendrier ; une valeur décimale est réservée au seuil d'âge et convertie en jours. */
export function ajouterDureeQuestionnaire(date: Date, duree: DureeQuestionnaire): Date {
  if (duree.unite === "MOIS" && Number.isInteger(duree.valeur)) return addMonths(date, duree.valeur);
  const jours = duree.unite === "SEMAINE" ? duree.valeur * 7 : duree.unite === "MOIS" ? duree.valeur * 30 : duree.valeur;
  return addDays(date, Math.round(jours));
}

export function dureeQuestionnaireEnJours(duree: DureeQuestionnaire): number {
  return Math.round(duree.unite === "SEMAINE" ? duree.valeur * 7 : duree.unite === "MOIS" ? duree.valeur * 30 : duree.valeur);
}

export function choisirBrancheAgePrimo(
  configuration: ConfigurationQuestionnaireV1,
  dateNaissance: Date,
  datePrimo: Date,
): BrancheAgePrimoQuestionnaire | null {
  if (configuration.demarrage.type !== "PRIMO_RAPPEL" || configuration.demarrage.rappel.type !== "BRANCHES_AGE_PRIMO") return null;
  const ageJours = differenceInCalendarDays(datePrimo, dateNaissance);
  const position = ageJours < dureeQuestionnaireEnJours(configuration.demarrage.rappel.seuilAgePrimo)
    ? "AVANT_SEUIL"
    : "A_PARTIR_SEUIL";
  return configuration.demarrage.rappel.branches.find((branche) => branche.position === position) ?? null;
}

export function brancheInitialeDepuisActes(
  configuration: ConfigurationQuestionnaireV1,
  dateNaissance: Date,
  actes: ReadonlyArray<{ etapeProtocoleId: string | null; date: Date }>,
): string | null {
  if (configuration.demarrage.type !== "PRIMO_RAPPEL" || configuration.demarrage.rappel.type !== "BRANCHES_AGE_PRIMO") return null;
  const etapePrimoId = configuration.demarrage.etapePrimoId;
  const primo = actes
    .filter((acte) => acte.etapeProtocoleId === etapePrimoId)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  return primo ? choisirBrancheAgePrimo(configuration, dateNaissance, primo.date)?.id ?? null : null;
}

export function fenetreRegleQuestionnaire(
  regle: RegleTemporelleQuestionnaire,
  dateNaissance: Date,
  dateVelagePrevue: Date | null | undefined,
  dateReference = new Date(),
): { debut: Date; fin: Date } | null {
  if (regle.type === "SANS_REGLE") return { debut: dateReference, fin: dateReference };
  if (regle.type === "AGE_MINIMUM") {
    const debut = ajouterDureeQuestionnaire(dateNaissance, regle.age);
    return { debut, fin: dateReference > debut ? dateReference : debut };
  }
  if (regle.type === "AVANT_VELAGE") {
    if (!dateVelagePrevue) return null;
    const debut = subDays(dateVelagePrevue, dureeQuestionnaireEnJours(regle.debutAvant));
    const fin = subDays(dateVelagePrevue, dureeQuestionnaireEnJours(regle.finAvant));
    return debut <= fin ? { debut, fin } : { debut: fin, fin: debut };
  }
  const mois = [...regle.mois].sort((a, b) => a - b);
  for (const decalageAnnee of [0, 1]) {
    const annee = dateReference.getFullYear() + decalageAnnee;
    for (const numeroMois of mois) {
      const debut = new Date(annee, numeroMois - 1, 1, 12);
      const fin = endOfMonth(debut);
      if (fin >= dateReference) return { debut, fin };
    }
  }
  return null;
}
