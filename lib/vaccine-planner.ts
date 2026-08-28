import { addDays, differenceInCalendarDays, subDays } from "date-fns";

export const STATUTS_CONSERVATION = ["IMMEDIATE", "CONSERVABLE", "INCONNUE"] as const;
export type StatutConservation = (typeof STATUTS_CONSERVATION)[number];

export interface RegleConservation {
  statut: StatutConservation;
  jours: number | null;
  condition: string | null;
  source: string | null;
  note: string | null;
  origine: "MEDICAMENT" | "CONDITIONNEMENT";
}

export interface RegleConservationBrute {
  conservationOuvertureStatut?: string | null;
  conservationOuvertureJours?: number | null;
  conservationOuvertureCondition?: string | null;
  conservationOuvertureSource?: string | null;
  conservationOuvertureNote?: string | null;
}

export function normaliserRegleConservationSaisie(
  value: RegleConservationBrute,
  autoriserHeritage = false
): {
  conservationOuvertureStatut: StatutConservation | null;
  conservationOuvertureJours: number | null;
  conservationOuvertureCondition: string | null;
  conservationOuvertureSource: string | null;
  conservationOuvertureNote: string | null;
} {
  const rawStatut = value.conservationOuvertureStatut;
  if (autoriserHeritage && (rawStatut == null || rawStatut === "" || rawStatut === "HERITER")) {
    return {
      conservationOuvertureStatut: null,
      conservationOuvertureJours: null,
      conservationOuvertureCondition: null,
      conservationOuvertureSource: null,
      conservationOuvertureNote: null,
    };
  }
  if (!STATUTS_CONSERVATION.includes(rawStatut as StatutConservation)) {
    throw new Error("Statut de conservation invalide");
  }
  const statut = rawStatut as StatutConservation;
  const joursBruts = value.conservationOuvertureJours;
  const jours = joursBruts == null || joursBruts === ("" as unknown as number) ? null : Number(joursBruts);
  if (statut === "CONSERVABLE" && (!Number.isInteger(jours) || Number(jours) < 0)) {
    throw new Error("La durée de conservation est requise");
  }
  return {
    conservationOuvertureStatut: statut,
    conservationOuvertureJours: statut === "CONSERVABLE" ? jours : null,
    conservationOuvertureCondition: value.conservationOuvertureCondition?.trim() || null,
    conservationOuvertureSource: value.conservationOuvertureSource?.trim() || null,
    conservationOuvertureNote: value.conservationOuvertureNote?.trim() || null,
  };
}

function statutConservation(value: string | null | undefined): StatutConservation {
  return STATUTS_CONSERVATION.includes(value as StatutConservation)
    ? (value as StatutConservation)
    : "INCONNUE";
}

function normaliserRegle(
  value: RegleConservationBrute,
  origine: RegleConservation["origine"]
): RegleConservation {
  const statut = statutConservation(value.conservationOuvertureStatut);
  const jours = statut === "CONSERVABLE" && Number.isInteger(value.conservationOuvertureJours)
    && Number(value.conservationOuvertureJours) >= 0
    ? Number(value.conservationOuvertureJours)
    : null;
  return {
    statut,
    jours,
    condition: value.conservationOuvertureCondition?.trim() || null,
    source: value.conservationOuvertureSource?.trim() || null,
    note: value.conservationOuvertureNote?.trim() || null,
    origine,
  };
}

/** Un statut null sur le conditionnement signifie héritage. INCONNUE est un override explicite. */
export function resoudreRegleConservation(
  medicament: RegleConservationBrute,
  conditionnement?: RegleConservationBrute | null
): RegleConservation {
  if (conditionnement?.conservationOuvertureStatut != null) {
    return normaliserRegle(conditionnement, "CONDITIONNEMENT");
  }
  return normaliserRegle(medicament, "MEDICAMENT");
}

/** La date limite est inclusive : une durée de 28 jours autorise une utilisation à J+28. */
export function calculerDateLimiteUtilisation(
  dateOuverture: Date,
  regle: Pick<RegleConservation, "statut" | "jours">
): Date | null {
  if (regle.statut === "IMMEDIATE") return new Date(dateOuverture);
  if (regle.statut !== "CONSERVABLE" || regle.jours == null) return null;
  return addDays(dateOuverture, regle.jours);
}

export function reliquatFlacon(
  dosesInitiales: number,
  utilisations: ReadonlyArray<{ dosesUtilisees: number }>
): number {
  const utilisees = utilisations.reduce((total, utilisation) => {
    if (!Number.isFinite(utilisation.dosesUtilisees) || utilisation.dosesUtilisees < 0) {
      throw new Error("Une utilisation de flacon doit être un nombre de doses positif");
    }
    return total + utilisation.dosesUtilisees;
  }, 0);
  return Math.max(0, dosesInitiales - utilisees);
}

export function reliquatUtilisableA(
  dateOuverture: Date,
  dateUtilisation: Date,
  regle: Pick<RegleConservation, "statut" | "jours">
): boolean {
  const limite = calculerDateLimiteUtilisation(dateOuverture, regle);
  if (!limite || differenceInCalendarDays(dateUtilisation, dateOuverture) < 0) return false;
  return differenceInCalendarDays(dateUtilisation, limite) <= 0;
}

export type TypeInjectionVaccinale = "ENTRETIEN" | "PRIMO_1" | "RAPPEL";

export interface FenetreVaccinale {
  debut: Date;
  fin: Date;
}

export const PROTOCOLE_PRE_VELAGE = {
  debutAvantVelageJours: 90,
  finAvantVelageJours: 21,
  intervallePrimoRappelJours: 28,
} as const;

export function calculerFenetreVaccinale(
  dateVelagePrevue: Date,
  type: Exclude<TypeInjectionVaccinale, "RAPPEL">
): FenetreVaccinale {
  const debut = subDays(dateVelagePrevue, PROTOCOLE_PRE_VELAGE.debutAvantVelageJours);
  const finAvantVelage = type === "PRIMO_1"
    ? PROTOCOLE_PRE_VELAGE.finAvantVelageJours + PROTOCOLE_PRE_VELAGE.intervallePrimoRappelJours
    : PROTOCOLE_PRE_VELAGE.finAvantVelageJours;
  return { debut, fin: subDays(dateVelagePrevue, finAvantVelage) };
}

export function calculerRappelPrimo(datePrimo: Date, dateVelagePrevue: Date): {
  date: Date;
  possible: boolean;
} {
  const date = addDays(datePrimo, PROTOCOLE_PRE_VELAGE.intervallePrimoRappelJours);
  const fenetre = calculerFenetreVaccinale(dateVelagePrevue, "ENTRETIEN");
  return { date, possible: dateDansFenetre(date, fenetre) };
}

export function dateDansFenetre(date: Date, fenetre: FenetreVaccinale): boolean {
  return differenceInCalendarDays(date, fenetre.debut) >= 0
    && differenceInCalendarDays(date, fenetre.fin) <= 0;
}

export function statutDateVaccinale(
  date: Date,
  fenetre: FenetreVaccinale,
  urgenceJours = 7
): "TROP_TOT" | "VACCINABLE" | "URGENT" | "HORS_DELAI" {
  if (differenceInCalendarDays(date, fenetre.debut) < 0) return "TROP_TOT";
  if (differenceInCalendarDays(date, fenetre.fin) > 0) return "HORS_DELAI";
  return differenceInCalendarDays(date, subDays(fenetre.fin, urgenceJours)) >= 0 ? "URGENT" : "VACCINABLE";
}

export type StatutProtocoleVaccinal =
  | "PROTOCOLE_ACQUIS"
  | "PRIMO_A_FAIRE"
  | "PRIMO_EN_COURS"
  | "A_CONFIRMER";

export function statutApresInjection(
  statutActuel: StatutProtocoleVaccinal,
  typeInjection: TypeInjectionVaccinale
): StatutProtocoleVaccinal {
  if (typeInjection === "PRIMO_1") return "PRIMO_EN_COURS";
  if (typeInjection === "RAPPEL") return "PROTOCOLE_ACQUIS";
  return statutActuel === "A_CONFIRMER" ? "A_CONFIRMER" : "PROTOCOLE_ACQUIS";
}

export function determinerProchaineInjection({
  statut,
  dateVelagePrevue,
  vaccinationsCycle,
}: {
  statut: StatutProtocoleVaccinal;
  dateVelagePrevue: Date;
  vaccinationsCycle: ReadonlyArray<{ date: Date; type: TypeInjectionVaccinale | null }>;
}): { type: TypeInjectionVaccinale | null; fenetre: FenetreVaccinale | null; aConfirmer: boolean; couvert: boolean } {
  if (statut === "A_CONFIRMER") return { type: null, fenetre: null, aConfirmer: true, couvert: false };
  if (statut === "PRIMO_A_FAIRE") {
    return { type: "PRIMO_1", fenetre: calculerFenetreVaccinale(dateVelagePrevue, "PRIMO_1"), aConfirmer: false, couvert: false };
  }
  if (statut === "PRIMO_EN_COURS") {
    const primo = vaccinationsCycle.find((vaccination) => vaccination.type === "PRIMO_1");
    if (!primo) return { type: null, fenetre: null, aConfirmer: true, couvert: false };
    const rappel = calculerRappelPrimo(primo.date, dateVelagePrevue);
    return {
      type: "RAPPEL",
      fenetre: rappel.possible ? { debut: rappel.date, fin: rappel.date } : null,
      aConfirmer: !rappel.possible,
      couvert: false,
    };
  }
  const entretienFait = vaccinationsCycle.some((vaccination) => vaccination.type === "ENTRETIEN");
  return entretienFait
    ? { type: null, fenetre: null, aConfirmer: false, couvert: true }
    : { type: "ENTRETIEN", fenetre: calculerFenetreVaccinale(dateVelagePrevue, "ENTRETIEN"), aConfirmer: false, couvert: false };
}
