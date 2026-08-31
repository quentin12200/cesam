import { addDays, addMonths, differenceInCalendarDays, subDays } from "date-fns";

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

export type StatutPreparationVaccin = "A_FAIRE" | "A_PREVOIR" | "TROP_TOT" | "EN_RETARD" | "TERMINE" | "A_CONFIRMER";

export interface EtapeVaccinaleConfig {
  id: string;
  label: string;
  ordre: number;
  cycle: string;
  reference: string;
  debutValeur: number;
  debutUnite: string;
  debutPosition: string;
  finValeur: number;
  finUnite: string;
  finPosition: string;
  dateFixe?: Date | null;
  recurrenceMois?: number | null;
  obligatoire?: boolean;
}

export interface ActionVaccinaleCalculee {
  statut: StatutPreparationVaccin;
  etape: EtapeVaccinaleConfig | null;
  dateMin: Date | null;
  dateMax: Date | null;
  raison: "AGE" | "VELAGE" | "ETAPE_PRECEDENTE" | "DATE_FIXE" | null;
}

type VaccinationEtape = { date: Date; etapeProtocoleId: string | null };

function decalageJours(value: number, unite: string): number {
  if (unite === "SEMAINE") return value * 7;
  if (unite === "MOIS") return value * 30;
  return value;
}

function appliquerDecalage(reference: Date, value: number, unite: string, position: string): Date {
  const jours = decalageJours(value, unite);
  return addDays(reference, position === "AVANT" ? -jours : jours);
}

function intersectionFenetre(
  fenetre: FenetreVaccinale,
  minimum: Date | null,
  maximum: Date | null
): FenetreVaccinale | null {
  const debut = minimum && minimum > fenetre.debut ? minimum : fenetre.debut;
  const fin = maximum && maximum < fenetre.fin ? maximum : fenetre.fin;
  return debut <= fin ? { debut, fin } : null;
}

export function calculerFenetreEtape({
  etape,
  dateNaissance,
  dateVelagePrevue,
  dateEtapePrecedente,
  ageMinJours,
  ageMaxJours,
}: {
  etape: EtapeVaccinaleConfig;
  dateNaissance: Date;
  dateVelagePrevue?: Date | null;
  dateEtapePrecedente?: Date | null;
  ageMinJours?: number | null;
  ageMaxJours?: number | null;
}): FenetreVaccinale | null {
  let reference: Date | null = null;
  if (etape.reference === "NAISSANCE") reference = dateNaissance;
  if (etape.reference === "VELAGE") reference = dateVelagePrevue ?? null;
  if (etape.reference === "ETAPE_PRECEDENTE") reference = dateEtapePrecedente ?? null;
  if (etape.reference === "DATE_FIXE") reference = etape.dateFixe ?? null;
  if (!reference) return null;

  const fenetre = etape.reference === "DATE_FIXE"
    ? { debut: reference, fin: reference }
    : {
        debut: appliquerDecalage(reference, etape.debutValeur, etape.debutUnite, etape.debutPosition),
        fin: appliquerDecalage(reference, etape.finValeur, etape.finUnite, etape.finPosition),
      };
  const ordonnee = fenetre.debut <= fenetre.fin
    ? fenetre
    : { debut: fenetre.fin, fin: fenetre.debut };
  return intersectionFenetre(
    ordonnee,
    ageMinJours == null ? null : addDays(dateNaissance, ageMinJours),
    ageMaxJours == null ? null : addDays(dateNaissance, ageMaxJours)
  );
}

function statutPreparation(date: Date, fenetre: FenetreVaccinale, bientotJours: number): StatutPreparationVaccin {
  if (date > fenetre.fin) return "EN_RETARD";
  if (date >= fenetre.debut) return "A_FAIRE";
  return differenceInCalendarDays(fenetre.debut, date) <= bientotJours ? "A_PREVOIR" : "TROP_TOT";
}

function etapesSuivantesPlanifiables({
  etapes,
  index,
  datePremiere,
  dateNaissance,
  dateVelagePrevue,
  ageMinJours,
  ageMaxJours,
}: {
  etapes: ReadonlyArray<EtapeVaccinaleConfig>;
  index: number;
  datePremiere: Date;
  dateNaissance: Date;
  dateVelagePrevue?: Date | null;
  ageMinJours?: number | null;
  ageMaxJours?: number | null;
}): boolean {
  let precedente = datePremiere;
  for (const etape of etapes.slice(index + 1).filter((item) => item.obligatoire !== false && item.cycle !== "ENTRETIEN")) {
    const fenetre = calculerFenetreEtape({ etape, dateNaissance, dateVelagePrevue, dateEtapePrecedente: precedente, ageMinJours, ageMaxJours });
    if (!fenetre) return false;
    const dateChoisie = fenetre.debut > precedente ? fenetre.debut : precedente;
    if (dateChoisie > fenetre.fin) return false;
    precedente = dateChoisie;
  }
  return true;
}

/** Calcule la prochaine intervention sans écrire de vaccination ni modifier le stock. */
export function calculerActionVaccinale({
  date,
  dateNaissance,
  dateVelagePrevue,
  ageMinJours,
  ageMaxJours,
  bientotJours = 30,
  etapes,
  vaccinations,
  statutProtocole,
}: {
  date: Date;
  dateNaissance: Date;
  dateVelagePrevue?: Date | null;
  ageMinJours?: number | null;
  ageMaxJours?: number | null;
  bientotJours?: number;
  etapes: ReadonlyArray<EtapeVaccinaleConfig>;
  vaccinations: ReadonlyArray<VaccinationEtape>;
  /** undefined conserve l'ancien calcul générique ; null signifie qu'aucun statut n'est renseigné. */
  statutProtocole?: StatutProtocoleVaccinal | null;
}): ActionVaccinaleCalculee {
  const toutesEtapes = [...etapes].sort((a, b) => a.ordre - b.ordre);
  const initiales = toutesEtapes.filter((etape) => etape.cycle !== "ENTRETIEN");
  const entretiens = toutesEtapes.filter((etape) => etape.cycle === "ENTRETIEN");
  let statutEffectif = statutProtocole;
  if (statutProtocole === null) {
    const initialesFaites = new Set(vaccinations.map((vaccination) => vaccination.etapeProtocoleId).filter(Boolean));
    if (initiales.some((etape) => initialesFaites.has(etape.id))) {
      statutEffectif = initiales.filter((etape) => etape.obligatoire !== false).every((etape) => initialesFaites.has(etape.id))
        ? "PROTOCOLE_ACQUIS"
        : "PRIMO_EN_COURS";
    } else {
      statutEffectif = "A_CONFIRMER";
    }
  }
  if (statutEffectif === "A_CONFIRMER") {
    return { statut: "A_CONFIRMER", etape: null, dateMin: null, dateMax: null, raison: null };
  }
  if (statutEffectif === "PRIMO_EN_COURS" && !initiales.some((etape) => vaccinations.some((vaccination) => vaccination.etapeProtocoleId === etape.id))) {
    return { statut: "A_CONFIRMER", etape: null, dateMin: null, dateMax: null, raison: null };
  }
  const ordonnees = statutEffectif === "PROTOCOLE_ACQUIS"
    ? entretiens
    : statutEffectif === "PRIMO_A_FAIRE" || statutEffectif === "PRIMO_EN_COURS"
      ? initiales
      : toutesEtapes;
  if (ordonnees.some((etape) => etape.obligatoire !== false && (
    (etape.reference === "VELAGE" && !dateVelagePrevue)
    || (etape.reference === "DATE_FIXE" && !etape.dateFixe)
  ))) {
    return { statut: "A_CONFIRMER", etape: null, dateMin: null, dateMax: null, raison: null };
  }
  let dateEtapePrecedente: Date | null = null;

  for (const [index, etape] of ordonnees.entries()) {
    const faites = vaccinations
      .filter((vaccination) => vaccination.etapeProtocoleId === etape.id)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (faites.length > 0 && etape.cycle !== "ENTRETIEN") {
      dateEtapePrecedente = faites[0].date;
      continue;
    }
    if (faites.length > 0 && etape.cycle === "ENTRETIEN" && !etape.recurrenceMois) continue;

    let fenetre: FenetreVaccinale | null;
    if (faites.length > 0 && etape.cycle === "ENTRETIEN" && etape.recurrenceMois) {
      const rappel = addMonths(faites[0].date, etape.recurrenceMois);
      fenetre = intersectionFenetre({ debut: rappel, fin: rappel },
        ageMinJours == null ? null : addDays(dateNaissance, ageMinJours),
        ageMaxJours == null ? null : addDays(dateNaissance, ageMaxJours));
    } else {
      fenetre = calculerFenetreEtape({ etape, dateNaissance, dateVelagePrevue, dateEtapePrecedente, ageMinJours, ageMaxJours });
    }
    if (!fenetre) {
      if (etape.obligatoire !== false) {
        return { statut: "A_CONFIRMER", etape: null, dateMin: null, dateMax: null, raison: null };
      }
      continue;
    }

    let statut = statutPreparation(date, fenetre, bientotJours);
    if (statut === "A_FAIRE" && !etapesSuivantesPlanifiables({
      etapes: ordonnees,
      index,
      datePremiere: date,
      dateNaissance,
      dateVelagePrevue,
      ageMinJours,
      ageMaxJours,
    })) statut = "EN_RETARD";
    return { statut, etape, dateMin: fenetre.debut, dateMax: fenetre.fin, raison: etape.reference as ActionVaccinaleCalculee["raison"] };
  }
  return { statut: "TERMINE", etape: null, dateMin: null, dateMax: null, raison: null };
}

export function proposerConditionnements({
  dosesNecessaires,
  reliquatsUtilisables,
  conditionnements,
}: {
  dosesNecessaires: number;
  reliquatsUtilisables: ReadonlyArray<number>;
  conditionnements: ReadonlyArray<number>;
}): { reliquatUtilise: number; nombre: number; dosesParConditionnement: number | null; totalDisponible: number } {
  const reliquatUtilise = Math.min(dosesNecessaires, reliquatsUtilisables.reduce((total, doses) => total + Math.max(0, doses), 0));
  const restant = Math.max(0, dosesNecessaires - reliquatUtilise);
  if (restant === 0) return { reliquatUtilise, nombre: 0, dosesParConditionnement: null, totalDisponible: reliquatUtilise };
  const options = conditionnements.filter((doses) => doses > 0).map((doses) => ({ doses, nombre: Math.ceil(restant / doses) }));
  options.sort((a, b) => (a.nombre * a.doses - restant) - (b.nombre * b.doses - restant) || a.nombre - b.nombre);
  const choix = options[0];
  if (!choix) return { reliquatUtilise, nombre: 0, dosesParConditionnement: null, totalDisponible: reliquatUtilise };
  return { reliquatUtilise, nombre: choix.nombre, dosesParConditionnement: choix.doses, totalDisponible: reliquatUtilise + choix.nombre * choix.doses };
}
