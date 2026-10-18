import { addDays, addMonths, differenceInCalendarDays, endOfMonth, subDays } from "date-fns";
import {
  ajouterDureeQuestionnaire,
  choisirBrancheAgePrimo,
  dureeQuestionnaireEnJours,
  fenetreRegleQuestionnaire,
  lireConfigurationQuestionnaire,
  type ConfigurationQuestionnaireV1,
  type DureeQuestionnaire,
} from "./vaccine-protocol-questionnaire.ts";
import { protocoleInitialAcquisDepuisHistorique } from "./vaccine-statut.ts";

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

export function resoudreVoieVaccinale({
  voiePreconisation,
  voieMedicament,
  voieLiaison,
}: {
  voiePreconisation?: string | null;
  voieMedicament?: string | null;
  voieLiaison?: string | null;
}): string {
  return voiePreconisation?.trim() || voieMedicament?.trim() || voieLiaison?.trim() || "À renseigner";
}

export type StatutPreparationVaccin = "A_FAIRE" | "A_PREVOIR" | "TROP_TOT" | "EN_RETARD" | "TERMINE" | "A_CONFIRMER" | "HORS_PROGRAMME";

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
  preconisationId?: string | null;
}

type VaccinationEtape = { date: Date; etapeProtocoleId: string | null };

function statutQuestionnaire(date: Date, fenetre: FenetreVaccinale, bientotJours: number): StatutPreparationVaccin {
  if (date > fenetre.fin) return "EN_RETARD";
  if (date >= fenetre.debut) return "A_FAIRE";
  return differenceInCalendarDays(fenetre.debut, date) <= bientotJours ? "A_PREVOIR" : "TROP_TOT";
}

function actionQuestionnaire(
  statut: StatutPreparationVaccin,
  etape: EtapeVaccinaleConfig | null,
  fenetre: FenetreVaccinale | null,
  raison: ActionVaccinaleCalculee["raison"],
  preconisationId: string | null = null,
): ActionVaccinaleCalculee {
  return { statut, etape, dateMin: fenetre?.debut ?? null, dateMax: fenetre?.fin ?? null, raison, preconisationId };
}

function raisonRegle(type: string): ActionVaccinaleCalculee["raison"] {
  if (type === "AGE_MINIMUM") return "AGE";
  if (type === "AVANT_VELAGE") return "VELAGE";
  return "DATE_FIXE";
}

function fenetrePonctuelle(date: Date): FenetreVaccinale {
  return { debut: date, fin: date };
}

function bornerPrimoPourRappel(
  configuration: ConfigurationQuestionnaireV1,
  fenetre: FenetreVaccinale,
  dateNaissance: Date,
  dateVelagePrevue: Date | null | undefined,
  dateCalcul: Date,
): FenetreVaccinale | null {
  if (configuration.demarrage.type !== "PRIMO_RAPPEL"
    || !configuration.demarrage.rappel.resterDansFenetrePrimo
    || configuration.demarrage.calendrierPrimo.type !== "AVANT_VELAGE"
    || !dateVelagePrevue) return fenetre;
  const finAutorisee = subDays(dateVelagePrevue, dureeQuestionnaireEnJours(configuration.demarrage.calendrierPrimo.finAvant));
  const rappel = configuration.demarrage.rappel;
  if (rappel.type === "DELAI_FIXE") {
    const fin = subDays(finAutorisee, dureeQuestionnaireEnJours(rappel.delai));
    return fenetre.debut <= fin ? { debut: fenetre.debut, fin: fin < fenetre.fin ? fin : fenetre.fin } : null;
  }
  const segments = rappel.branches.map((branche) => {
    const seuil = dureeQuestionnaireEnJours(rappel.seuilAgePrimo);
    const limiteBranche = branche.position === "AVANT_SEUIL"
      ? addDays(dateNaissance, seuil - 1)
      : addDays(dateNaissance, seuil);
    const debut = branche.position === "AVANT_SEUIL" ? fenetre.debut : (limiteBranche > fenetre.debut ? limiteBranche : fenetre.debut);
    const finAge = branche.position === "AVANT_SEUIL" && limiteBranche < fenetre.fin ? limiteBranche : fenetre.fin;
    const finRappel = subDays(finAutorisee, dureeQuestionnaireEnJours(branche.delaiRappel));
    const fin = finRappel < finAge ? finRappel : finAge;
    return debut <= fin ? { debut, fin } : null;
  }).filter((segment): segment is FenetreVaccinale => segment != null);
  if (segments.length === 0) return null;
  segments.sort((a, b) => a.debut.getTime() - b.debut.getTime());
  return segments.find((segment) => dateCalcul >= segment.debut && dateCalcul <= segment.fin)
    ?? segments.find((segment) => segment.debut > dateCalcul)
    ?? segments[segments.length - 1];
}

/** Moteur canonique des protocoles questionnaire. Il ne lit jamais les anciens champs de calendrier. */
export function calculerActionVaccinaleQuestionnaire({
  date,
  dateNaissance,
  dateVelagePrevue,
  bientotJours,
  etapes,
  vaccinations,
  statutProtocole,
  brancheInitialeId,
  configuration,
}: {
  date: Date;
  dateNaissance: Date;
  dateVelagePrevue?: Date | null;
  bientotJours: number;
  etapes: ReadonlyArray<EtapeVaccinaleConfig>;
  vaccinations: ReadonlyArray<VaccinationEtape>;
  statutProtocole?: StatutProtocoleVaccinal | null;
  brancheInitialeId?: string | null;
  configuration: ConfigurationQuestionnaireV1;
}): ActionVaccinaleCalculee {
  const etapeParId = (id: string) => etapes.find((etape) => etape.id === id) ?? null;
  if (statutProtocole === "A_CONFIRMER") return actionQuestionnaire("A_CONFIRMER", null, null, null);
  const demarrage = configuration.demarrage;
  const idPrimo = demarrage.type === "DOSE_UNIQUE" ? demarrage.etapeDoseId : demarrage.etapePrimoId;
  const idRappel = demarrage.type === "PRIMO_RAPPEL" ? demarrage.etapeRappelId : null;
  const primo = vaccinations.filter((acte) => acte.etapeProtocoleId === idPrimo).sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null;
  const rappel = idRappel ? vaccinations.filter((acte) => acte.etapeProtocoleId === idRappel).sort((a, b) => b.date.getTime() - a.date.getTime())[0] ?? null : null;
  const initialTermine = demarrage.type === "DOSE_UNIQUE" ? Boolean(primo) : Boolean(primo && rappel);

  if (!initialTermine && statutProtocole !== "PROTOCOLE_ACQUIS") {
    if (!primo) {
      // Règle optionnelle de l'élevage : une Primo non commencée ne doit pas rester en retard à vie.
      // Ne s'applique JAMAIS à un rappel après Primo réellement faite, ni aux cycles de vêlage.
      if (configuration.ageMaxDemarrage && differenceInCalendarDays(date, ajouterDureeQuestionnaire(dateNaissance, configuration.ageMaxDemarrage)) > 0) {
        return actionQuestionnaire("HORS_PROGRAMME", etapeParId(idPrimo), null, "AGE");
      }
      const regle = demarrage.type === "DOSE_UNIQUE" ? demarrage.calendrier : demarrage.calendrierPrimo;
      const brute = fenetreRegleQuestionnaire(regle, dateNaissance, dateVelagePrevue, date);
      const fenetre = brute && demarrage.type === "PRIMO_RAPPEL"
        ? bornerPrimoPourRappel(configuration, brute, dateNaissance, dateVelagePrevue, date)
        : brute;
      if (!fenetre) return actionQuestionnaire("A_CONFIRMER", null, null, null);
      const etape = etapeParId(idPrimo);
      let preconisationId = demarrage.type === "DOSE_UNIQUE" ? demarrage.preconisationId : demarrage.rappel.type === "DELAI_FIXE" ? demarrage.rappel.preconisationPrimoId : null;
      if (demarrage.type === "PRIMO_RAPPEL" && demarrage.rappel.type === "BRANCHES_AGE_PRIMO") {
        const datePrimoProbable = date < fenetre.debut ? fenetre.debut : date > fenetre.fin ? fenetre.fin : date;
        preconisationId = choisirBrancheAgePrimo(configuration, dateNaissance, datePrimoProbable)?.preconisationPrimoId ?? null;
      }
      return actionQuestionnaire(statutQuestionnaire(date, fenetre, bientotJours), etape, fenetre, raisonRegle(regle.type), preconisationId);
    }
    if (demarrage.type === "PRIMO_RAPPEL" && !rappel) {
      let delai: DureeQuestionnaire;
      let preconisationId: string;
      if (demarrage.rappel.type === "BRANCHES_AGE_PRIMO") {
        const branche = demarrage.rappel.branches.find((item) => item.id === brancheInitialeId);
        // La branche ne doit jamais être recalculée à l'âge du rappel.
        if (!branche) return actionQuestionnaire("A_CONFIRMER", null, null, null);
        delai = branche.delaiRappel;
        preconisationId = branche.preconisationRappelId;
      } else { delai = demarrage.rappel.delai; preconisationId = demarrage.rappel.preconisationRappelId; }
      const dateRappel = ajouterDureeQuestionnaire(primo.date, delai);
      let fenetre = fenetrePonctuelle(dateRappel);
      if (demarrage.rappel.resterDansFenetrePrimo && demarrage.calendrierPrimo.type === "AVANT_VELAGE") {
        const autorisee = fenetreRegleQuestionnaire(demarrage.calendrierPrimo, dateNaissance, dateVelagePrevue, date);
        if (!autorisee || dateRappel < autorisee.debut || dateRappel > autorisee.fin) return actionQuestionnaire("A_CONFIRMER", null, null, null);
        fenetre = { debut: dateRappel, fin: dateRappel };
      }
      return actionQuestionnaire(statutQuestionnaire(date, fenetre, bientotJours), etapeParId(demarrage.etapeRappelId), fenetre, "ETAPE_PRECEDENTE", preconisationId);
    }
  }

  if (!configuration.entretien.actif) return actionQuestionnaire("TERMINE", null, null, null);
  const entretien = configuration.entretien;
  const etape = etapeParId(entretien.etapeId);
  const actesEntretien = vaccinations.filter((acte) => acte.etapeProtocoleId === entretien.etapeId).sort((a, b) => b.date.getTime() - a.date.getTime());
  const finInitiale = demarrage.type === "DOSE_UNIQUE" ? primo?.date : rappel?.date;
  let fenetre: FenetreVaccinale | null = null;
  if (entretien.calendrier.type === "APRES_DELAI") {
    const reference = actesEntretien[0]?.date ?? finInitiale;
    if (!reference) return actionQuestionnaire("A_CONFIRMER", null, null, null);
    const delai = actesEntretien.length > 0 ? entretien.calendrier.recurrence : entretien.calendrier.premierDelai;
    fenetre = fenetrePonctuelle(ajouterDureeQuestionnaire(reference, delai));
  } else if (entretien.calendrier.type === "AVANT_VELAGE") {
    if (actesEntretien.length > 0) return actionQuestionnaire("TERMINE", null, null, null);
    fenetre = fenetreRegleQuestionnaire(entretien.calendrier, dateNaissance, dateVelagePrevue, date);
  } else {
    const reference = actesEntretien[0] ? addDays(endOfMonth(actesEntretien[0].date), 1) : date;
    fenetre = fenetreRegleQuestionnaire(entretien.calendrier, dateNaissance, dateVelagePrevue, reference);
  }
  if (!fenetre) return actionQuestionnaire("A_CONFIRMER", null, null, null);
  return actionQuestionnaire(statutQuestionnaire(date, fenetre, bientotJours), etape, fenetre, raisonRegle(entretien.calendrier.type), entretien.preconisationId);
}

/** Insensible à la casse : des étapes réelles en base portent "semaine"/"mois"/"jour" en
 * minuscules (saisies hors de ProtocoleEditor, qui n'envoie que du majuscule). Une comparaison
 * stricte faisait silencieusement tomber "semaine"/"mois" dans le cas par défaut (jours), d'où
 * des rappels calculés à N jours au lieu de N semaines/mois. */
function decalageJours(value: number, unite: string): number {
  const normalisee = unite.trim().toUpperCase();
  if (normalisee === "SEMAINE") return value * 7;
  if (normalisee === "MOIS") return value * 30;
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
  historiqueVaccinations,
  statutProtocole,
  configurationQuestionnaireJson,
  brancheInitialeId,
}: {
  date: Date;
  dateNaissance: Date;
  dateVelagePrevue?: Date | null;
  ageMinJours?: number | null;
  ageMaxJours?: number | null;
  bientotJours?: number;
  etapes: ReadonlyArray<EtapeVaccinaleConfig>;
  vaccinations: ReadonlyArray<VaccinationEtape>;
  /** Actes FAIT de tous les cycles, utilisés seulement comme preuve de l'acquisition initiale. */
  historiqueVaccinations?: ReadonlyArray<VaccinationEtape>;
  /** undefined conserve l'ancien calcul générique ; null signifie qu'aucun statut n'est renseigné. */
  statutProtocole?: StatutProtocoleVaccinal | null;
  /** Non-null bascule exclusivement vers le moteur questionnaire. */
  configurationQuestionnaireJson?: string | null;
  brancheInitialeId?: string | null;
}): ActionVaccinaleCalculee {
  const statutDeduit = protocoleInitialAcquisDepuisHistorique(etapes, historiqueVaccinations ?? vaccinations)
    ? "PROTOCOLE_ACQUIS"
    : statutProtocole;
  if (configurationQuestionnaireJson != null) {
    const configuration = lireConfigurationQuestionnaire(configurationQuestionnaireJson);
    if (!configuration) return { statut: "A_CONFIRMER", etape: null, dateMin: null, dateMax: null, raison: null };
    return calculerActionVaccinaleQuestionnaire({ date, dateNaissance, dateVelagePrevue, bientotJours, etapes, vaccinations, statutProtocole: statutDeduit, brancheInitialeId, configuration });
  }
  const toutesEtapes = [...etapes].sort((a, b) => a.ordre - b.ordre);
  const initiales = toutesEtapes.filter((etape) => etape.cycle !== "ENTRETIEN");
  const entretiens = toutesEtapes.filter((etape) => etape.cycle === "ENTRETIEN");
  let statutEffectif = statutDeduit;
  if (statutEffectif === null) {
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
    // Une étape basée sur le vêlage suit TOUJOURS la date de vêlage concernée : une récurrence en mois
    // ne s'applique pas (sinon "dernier acte + N mois" écraserait le nouveau vêlage).
    const recurrenceActive = Boolean(etape.recurrenceMois) && etape.reference !== "VELAGE";
    if (faites.length > 0 && etape.cycle === "ENTRETIEN" && !recurrenceActive) continue;

    let fenetre: FenetreVaccinale | null;
    if (faites.length > 0 && etape.cycle === "ENTRETIEN" && recurrenceActive) {
      const rappel = addMonths(faites[0].date, etape.recurrenceMois!);
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
  conditionnements: ReadonlyArray<number | {
    doses: number;
    prixFlaconEur?: number | null;
    conservationOuvertureStatut?: string | null;
  }>;
}): {
  reliquatUtilise: number;
  nombre: number;
  dosesParConditionnement: number | null;
  totalDisponible: number;
  perte: number;
  conservationConnue: boolean;
  achats: Array<{ doses: number; nombre: number }>;
} {
  const reliquatUtilise = Math.min(dosesNecessaires, reliquatsUtilisables.reduce((total, doses) => total + Math.max(0, doses), 0));
  const restant = Math.max(0, dosesNecessaires - reliquatUtilise);
  if (restant === 0) return { reliquatUtilise, nombre: 0, dosesParConditionnement: null, totalDisponible: reliquatUtilise, perte: 0, conservationConnue: true, achats: [] };
  const formats = conditionnements
    .map((conditionnement) => typeof conditionnement === "number"
      ? { doses: conditionnement, prixFlaconEur: null, conservationOuvertureStatut: null }
      : conditionnement)
    .filter((conditionnement) => Number.isFinite(conditionnement.doses) && conditionnement.doses > 0);
  if (formats.length === 0) return { reliquatUtilise, nombre: 0, dosesParConditionnement: null, totalDisponible: reliquatUtilise, perte: 0, conservationConnue: false, achats: [] };

  const toutesAvecPrix = formats.every((format) => format.prixFlaconEur != null && Number.isFinite(format.prixFlaconEur));
  const maxDose = Math.ceil(Math.max(...formats.map((format) => format.doses)));
  const limite = Math.ceil(restant) + maxDose;
  type Option = { total: number; cout: number; nombre: number; achats: number[] };
  const options: Option[] = [{ total: 0, cout: 0, nombre: 0, achats: Array(formats.length).fill(0) }];
  for (let total = 0; total <= limite; total += 1) {
    const base = options[total];
    if (!base) continue;
    formats.forEach((format, index) => {
      const prochainTotal = total + Math.ceil(format.doses);
      if (prochainTotal > limite) return;
      const candidat: Option = {
        total: prochainTotal,
        cout: base.cout + (format.prixFlaconEur ?? 0),
        nombre: base.nombre + 1,
        achats: base.achats.map((nombre, achatIndex) => nombre + (achatIndex === index ? 1 : 0)),
      };
      const actuel = options[prochainTotal];
      if (!actuel || (toutesAvecPrix
        ? candidat.cout < actuel.cout || (candidat.cout === actuel.cout && candidat.nombre < actuel.nombre)
        : candidat.nombre < actuel.nombre)) options[prochainTotal] = candidat;
    });
  }
  const candidates = options.filter((option) => option && option.total >= restant);
  const tolerance = Math.max(1, restant * 0.1);
  candidates.sort((a, b) => {
    if (toutesAvecPrix) return a.cout - b.cout || a.nombre - b.nombre || (a.total - restant) - (b.total - restant);
    const aFaiblePerte = a.total - restant <= tolerance;
    const bFaiblePerte = b.total - restant <= tolerance;
    if (aFaiblePerte !== bFaiblePerte) return aFaiblePerte ? -1 : 1;
    return aFaiblePerte
      ? a.nombre - b.nombre || (a.total - restant) - (b.total - restant)
      : (a.total - restant) - (b.total - restant) || a.nombre - b.nombre;
  });
  const choix = candidates[0];
  if (!choix) return { reliquatUtilise, nombre: 0, dosesParConditionnement: null, totalDisponible: reliquatUtilise, perte: 0, conservationConnue: false, achats: [] };
  const achats = choix.achats.flatMap((nombre, index) => nombre > 0 ? [{ doses: formats[index].doses, nombre }] : []);
  const formatUnique = achats.length === 1 ? achats[0] : null;
  return {
    reliquatUtilise,
    nombre: choix.nombre,
    dosesParConditionnement: formatUnique?.doses ?? null,
    totalDisponible: reliquatUtilise + choix.total,
    perte: choix.total - restant,
    conservationConnue: achats.every((achat) => {
      const format = formats.find((item) => item.doses === achat.doses);
      return format?.conservationOuvertureStatut === "IMMEDIATE" || format?.conservationOuvertureStatut === "CONSERVABLE";
    }),
    achats,
  };
}
