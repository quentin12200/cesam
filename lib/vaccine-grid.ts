/**
 * Grille vaccinale « esprit Excel » : un bloc de colonnes par vaccin, une sous-colonne par
 * étape réelle du protocole (rien n'est inventé : sans protocole configuré, un vaccin garde
 * une seule sous-colonne, comme avant).
 *
 * Les faits sont interprétés en lecture seule par vaccine-history.ts et la même résolution
 * alimente la grille et la préparation de séance.
 */
import { calculerActionVaccinale, calculerFenetreEtape, type EtapeVaccinaleConfig, type StatutProtocoleVaccinal } from "./vaccine-planner.ts";
import { configurationQuestionnaireLieeAuVelage, lireConfigurationQuestionnaire } from "./vaccine-protocol-questionnaire.ts";
import { statutPlanningVaccin } from "./vaccine-planning-status.ts";
import { interpreterHistoriqueVaccinal, medicamentPartageEntreProtocoles, nomVaccinComparable } from "./vaccine-history.ts";
import { expliquerExclusionsVaccinales, type ExclusionVaccinale } from "./vaccine-eligibility.ts";
import { addDays, addMonths } from "date-fns";
import type { ActeVaccination } from "./vaccine-acts.ts";
import { medicamentCompatibleAvecEtape } from "./vaccine-attachment.ts";
import { protocoleInitialAcquisDepuisHistorique } from "./vaccine-statut.ts";

export interface EtapeGrille extends EtapeVaccinaleConfig {
  medicamentId: string | null;
  medicamentNom: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  preconisations?: readonly { id: string; voie: string | null; dose: number | null; unite: string | null }[];
  medicaments: readonly { medicament: { id: string; nom: string } }[];
}

export interface ProtocoleGrille {
  id: string;
  nom: string;
  label: string;
  configurationQuestionnaireJson?: string | null;
  ageMinJours: number;
  ageMaxJours: number | null;
  categoriesJson: string | null;
  sexeCible: string | null;
  gestante: boolean | null;
  rangVelageMin: number | null;
  rangVelageMax: number | null;
  lotCible: string | null;
  etapes: readonly EtapeGrille[];
}

export interface VaccinPharmacieGrille {
  medicamentId: string;
  nom: string;
  voie: string | null;
}

export interface AnimalGrille {
  id: string;
  nutrav: string;
  nom: string | null;
  mereNutrav?: string | null;
  mereNom?: string | null;
  mereLiee?: boolean;
  sexe: string;
  danaisIso: string;
  categorie: string;
  nombreVelages: number;
  groupeNom: string | null;
  gestationId: string | null;
  dateVelagePrevueIso: string | null;
  /** Statuts existants, lus uniquement : la grille ne les modifie jamais. */
  statutsProtocoles?: readonly { protocoleId: string; statut: StatutProtocoleVaccinal; brancheInitialeId?: string | null }[];
  /** Historique déjà fusionné (Vaccination + Traitement VACCIN), voir lib/vaccine-acts.ts. */
  actes: readonly ActeVaccination[];
}

function etapePlanifiableSelonStatut(
  etape: EtapeGrille,
  statut: StatutProtocoleVaccinal | null,
): boolean {
  if (statut === "A_CONFIRMER") return false;
  if (statut === "PROTOCOLE_ACQUIS") return etape.cycle === "ENTRETIEN";
  if (statut === "PRIMO_A_FAIRE" || statut === "PRIMO_EN_COURS") return etape.cycle !== "ENTRETIEN";
  return true;
}

/** Garde générique : une étape initiale d'un parcours pré-vêlage ne déborde jamais après le vêlage. */
export function bornerFenetreInitialeAuVelage(
  fenetre: { debut: Date; fin: Date } | null,
  dateVelagePrevue: Date | null,
  applicable: boolean,
): { debut: Date; fin: Date } | null {
  if (!fenetre || !dateVelagePrevue || !applicable) return fenetre;
  if (fenetre.debut.getTime() > dateVelagePrevue.getTime()) return null;
  return {
    debut: fenetre.debut,
    fin: fenetre.fin.getTime() > dateVelagePrevue.getTime() ? dateVelagePrevue : fenetre.fin,
  };
}

export interface SousColonneGrille {
  id: string;
  label: string;
  cycle: string | null;
  protocoleId: string | null;
  medicamentId: string | null;
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
}

export interface BlocVaccinGrille {
  cle: string;
  nom: string;
  voie: string | null;
  sousColonnes: SousColonneGrille[];
  /** Contexte transmis au flux sanitaire existant lors d'une séance. */
  protocoleId: string | null;
  medicamentId: string | null;
  protocoleNom: string | null;
  protocoleLieAuVelage: boolean;
  /** Tous les médicaments liés aux étapes (y compris alternatives) : sert à retrouver l'historique du vaccin. */
  medicamentIds: string[];
  /** Étapes configurées et leurs médicaments, pour proposer uniquement les étapes compatibles. */
  etapes: { id: string; reference: string; cycle: string; medicamentIds: string[] }[];
}

export type StatutCelluleGrille = "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "PREVU" | "VIDE";

export type MotifSansEcheance = "HORS_CIBLE" | "ACQUIS_SANS_PREUVE" | "CALCUL_A_CONFIRMER";

export interface CelluleGrille {
  statut: StatutCelluleGrille;
  /** Explication en lecture seule, jamais une preuve d'injection ni une décision vétérinaire. */
  motifSansEcheance?: MotifSansEcheance;
  raisonsHorsCible?: ExclusionVaccinale[];
  date: Date | null;
  aValider: boolean;
  rattachementProtocoleAutorise: boolean;
  historiquesAValider: HistoriqueVaccinalAValider[];
  /** TOUS les actes réels de cette étape (jamais seulement le dernier), du plus ancien au plus récent. */
  actes: ActeCellule[];
  /** Prochaine échéance quand l'étape a déjà des actes et une récurrence configurée. */
  prochaine: { statut: Exclude<StatutCelluleGrille, "FAIT" | "VIDE">; date: Date; fenetre: { debut: Date; fin: Date } } | null;
  /** Fenêtre calculée par le planner pour une échéance (jamais pour une case FAIT). */
  fenetre?: { debut: Date; fin: Date } | null;
  /** Hors fenêtre d'âge choisie par l'élevage, pas un acte réalisé ni une contre-indication. */
  horsProgramme?: boolean;
  /** Administration spécifique à l'animal (branche questionnaire), issue de la Pharmacie. */
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
}

/** Acte réel unifié (Vaccination ou Traitement VACCIN) tel que présenté dans la grille. */
export interface ActeCellule {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string | null;
  etapeProtocoleId: string | null;
  gestationId: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
}

function versActeCellule(acte: ActeVaccination): ActeCellule {
  return {
    sourceType: acte.sourceType ?? "VACCINATION",
    sourceId: acte.sourceId ?? null,
    date: acte.date,
    vaccin: acte.vaccin,
    medicamentId: acte.medicamentId,
    protocoleId: acte.protocoleId,
    etapeProtocoleId: acte.etapeProtocoleId,
    gestationId: acte.gestationId,
    voie: acte.voie ?? null,
    dose: acte.dose ?? null,
    uniteDosage: acte.uniteDosage ?? null,
  };
}


export interface HistoriqueVaccinalAValider {
  sourceType: "VACCINATION" | "TRAITEMENT";
  sourceId: string | null;
  date: Date;
  vaccin: string;
  medicamentId: string | null;
  protocoleId: string;
  protocoleNom: string;
  gestationId: string | null;
  raison: string;
  /** Vrai si une etape du protocole depend du velage : seule situation ou la gestation compte. */
  protocoleLieAuVelage: boolean;
  /** Etapes reellement configurees et compatibles avec le medicament reel de l'acte. */
  etapesCompatibles: { id: string; label: string }[];
}

export interface LigneGrille {
  animalId: string;
  nutrav: string;
  nom: string | null;
  mereNutrav: string | null;
  mereNom: string | null;
  mereLiee: boolean;
  sexe: string;
  danaisIso: string;
  gestationId: string | null;
  dateVelagePrevueIso: string | null;
  cellules: Record<string, CelluleGrille>;
  /** Historique vaccinal complet de l'animal (aucun filtre d'année : c'est le planner qui l'utilise). */
  actes: ActeCellule[];
}

function medicamentPrincipal(protocole: ProtocoleGrille): { id: string; nom: string } | null {
  const premier = protocole.etapes.find((etape) => etape.medicamentId);
  return premier?.medicamentId ? { id: premier.medicamentId, nom: premier.medicamentNom || protocole.label } : null;
}

/** Construit les blocs de colonnes : une sous-colonne par étape réelle, ou une seule
 * sous-colonne pseudo pour un vaccin de pharmacie sans protocole configuré. */
export function construireBlocsVaccinaux(
  protocoles: readonly ProtocoleGrille[],
  vaccinsPharmacie: readonly VaccinPharmacieGrille[]
): BlocVaccinGrille[] {
  const blocs = new Map<string, BlocVaccinGrille>();
  const medicamentsCouverts = new Set<string>();

  for (const protocole of protocoles) {
    if (protocole.etapes.length === 0) continue;
    const medicament = medicamentPrincipal(protocole);
    const cle = medicament?.id ?? protocole.id;
    for (const etape of protocole.etapes) {
      if (etape.medicamentId) medicamentsCouverts.add(etape.medicamentId);
      for (const liaison of etape.medicaments) medicamentsCouverts.add(liaison.medicament.id);
    }
    const voie = vaccinsPharmacie.find((v) => v.medicamentId === medicament?.id)?.voie ?? null;
    if (!blocs.has(cle)) {
      blocs.set(cle, {
        cle,
        nom: medicament?.nom || protocole.label,
        voie,
        sousColonnes: [...protocole.etapes]
          .sort((a, b) => a.ordre - b.ordre)
          .map((etape) => ({
            id: etape.id,
            label: etape.label,
            cycle: etape.cycle,
            protocoleId: protocole.id,
            medicamentId: etape.medicamentId ?? medicament?.id ?? null,
            medicamentNom: etape.medicamentNom ?? medicament?.nom ?? null,
            voie: etape.voie && etape.voie !== "À renseigner" ? etape.voie : voie,
            dose: etape.dose ?? null,
            uniteDosage: etape.uniteDosage ?? null,
          })),
        protocoleId: protocole.id,
        medicamentId: medicament?.id ?? null,
        protocoleNom: protocole.label || protocole.nom,
        protocoleLieAuVelage: (() => {
          const configuration = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
          if (!configuration) return protocole.etapes.some((etape) => etape.reference === "VELAGE");
          return configurationQuestionnaireLieeAuVelage(configuration);
        })(),
        medicamentIds: [...new Set([
          ...(medicament ? [medicament.id] : []),
          ...protocole.etapes.flatMap((etape) => [
            ...(etape.medicamentId ? [etape.medicamentId] : []),
            ...etape.medicaments.map((liaison) => liaison.medicament.id),
          ]),
        ])],
        etapes: protocole.etapes.map((etape) => ({
          id: etape.id,
          reference: etape.reference,
          cycle: etape.cycle,
          medicamentIds: etape.medicaments.map((liaison) => liaison.medicament.id),
        })),
      });
    }
  }

  for (const vaccin of vaccinsPharmacie) {
    if (medicamentsCouverts.has(vaccin.medicamentId) || blocs.has(vaccin.medicamentId)) continue;
    blocs.set(vaccin.medicamentId, {
      cle: vaccin.medicamentId,
      nom: vaccin.nom,
      voie: vaccin.voie,
      sousColonnes: [{
        id: vaccin.medicamentId,
        label: "",
        cycle: null,
        protocoleId: null,
        medicamentId: vaccin.medicamentId,
        medicamentNom: vaccin.nom,
        voie: vaccin.voie,
        dose: null,
        uniteDosage: null,
      }],
      protocoleId: null,
      medicamentId: vaccin.medicamentId,
      protocoleNom: null,
      protocoleLieAuVelage: false,
      medicamentIds: [vaccin.medicamentId],
      etapes: [],
    });
  }

  return [...blocs.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function celluleVide(): CelluleGrille {
  return { statut: "VIDE", date: null, aValider: false, rattachementProtocoleAutorise: false, historiquesAValider: [], actes: [], prochaine: null };
}

function celluleDepuisPlanning(date: Date, fenetre: { debut: Date; fin: Date }): CelluleGrille {
  const statut = statutPlanningVaccin(date, fenetre.debut, fenetre.fin);
  // Une echeance calculee ne disparait jamais parce qu'elle est lointaine : elle reste visible, en
  // "prevu plus tard" (ni a faire, ni en retard), et la case reste selectionnable.
  const avecFenetre = (cellule: CelluleGrille): CelluleGrille => ({ ...cellule, fenetre: { debut: fenetre.debut, fin: fenetre.fin } });
  if (statut === "TROP_TOT") return avecFenetre({ statut: "PREVU", date: fenetre.debut, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [], prochaine: null });
  if (statut === "EN_RETARD_LEGER" || statut === "EN_RETARD") return avecFenetre({ statut: "EN_RETARD", date: fenetre.fin, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [], prochaine: null });
  // Bientôt (fenêtre pas encore ouverte mais proche) reste distinct d'à faire (fenêtre ouverte,
  // à faire maintenant) : même donnée du moteur (statutPlanningVaccin), affichage plus fin.
  if (statut === "A_PREVOIR") return avecFenetre({ statut: "BIENTOT", date: fenetre.debut, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [], prochaine: null });
  return avecFenetre({ statut: "A_FAIRE", date: fenetre.fin, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [], prochaine: null });
}

/** Cellules d'un animal pour un protocole : une par étape réelle, dans l'ordre. */
function celluleProtocole(
  animal: AnimalGrille,
  protocole: ProtocoleGrille,
  protocoles: readonly ProtocoleGrille[],
  date: Date
): Map<string, CelluleGrille> {
  const cellules = new Map<string, CelluleGrille>();
  const etapes = [...protocole.etapes].sort((a, b) => a.ordre - b.ordre);
  // L'éligibilité ne sert qu'à ne pas INVENTER une recommandation "à faire"/"en retard" pour un
  // animal que le protocole ne cible plus (ex : catégorie recalculée depuis). Une vaccination
  // réellement faite reste toujours affichée comme faite, quelle que soit l'éligibilité
  // actuelle : « une vaccination réellement enregistrée doit toujours être visible comme faite ».
  const raisonsHorsCible = expliquerExclusionsVaccinales(
    { categorie: animal.categorie, sexbov: animal.sexe, groupeNom: animal.groupeNom, nombreVelages: animal.nombreVelages, gestation: Boolean(animal.gestationId) },
    protocole
  );
  const eligible = raisonsHorsCible.length === 0;

  const configurationQuestionnaire = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
  const protocoleLieAuVelage = configurationQuestionnaire
    ? configurationQuestionnaireLieeAuVelage(configurationQuestionnaire)
    : etapes.some((etape) => etape.reference === "VELAGE");
  const statutEnregistre = animal.statutsProtocoles?.find((statut) => statut.protocoleId === protocole.id) ?? null;
  const medicaments = etapes.flatMap((e) => e.medicaments.map((m) => m.medicament));
  const correspondanceHistorique = {
    id: protocole.id,
    noms: [protocole.nom, protocole.label, ...medicaments.map((m) => m.nom)],
    medicamentIds: medicaments.map((m) => m.id),
    etapeIds: etapes.map((e) => e.id),
  };
  const interpretation = interpreterHistoriqueVaccinal(animal.actes, {
    ...correspondanceHistorique, etapes, configurationQuestionnaireJson: protocole.configurationQuestionnaireJson,
  }, { protocoleLieAuVelage, medicamentPartage: medicamentPartageEntreProtocoles(protocole, protocoles), gestationId: animal.gestationId });
  const actesHistoriquesDuProtocole = interpretation.historique;
  const actesUtiles = interpretation.vaccinations;
  const statutProtocole = protocoleInitialAcquisDepuisHistorique(etapes, actesHistoriquesDuProtocole)
    ? "PROTOCOLE_ACQUIS" : statutEnregistre?.statut ?? null;
  // Un statut acquis enregistré, mais dépourvu d'injection probante, ne doit pas faire croire
  // que la vaccination est faite ou que l'absence d'échéance est normale.
  const acquisSansPreuve = statutProtocole === "PROTOCOLE_ACQUIS" && actesHistoriquesDuProtocole.length === 0;
  const premiereInitiale = etapes.find((etape) => etape.cycle !== "ENTRETIEN") ?? etapes[0] ?? null;
  const marquerAbsence = (motif: MotifSansEcheance) => {
    if (!premiereInitiale) return;
    const cellule = cellules.get(premiereInitiale.id) ?? celluleVide();
    if (cellule.statut === "VIDE" && cellule.actes.length === 0) {
      cellules.set(premiereInitiale.id, { ...cellule, motifSansEcheance: motif,
        ...(motif === "HORS_CIBLE" ? { raisonsHorsCible } : {}) });
    }
  };

  // Même garantie après les deux chemins (questionnaire et legacy) : aucun fait ne disparaît.
  const finaliserHistorique = () => {
    const versHistorique = (acte: ActeVaccination, raison?: string): HistoriqueVaccinalAValider => ({
      sourceType: acte.sourceType ?? "VACCINATION", sourceId: acte.sourceId ?? null,
      date: acte.date, vaccin: acte.vaccin, medicamentId: acte.medicamentId,
      protocoleId: protocole.id, protocoleNom: protocole.label || protocole.nom,
      gestationId: acte.gestationId, protocoleLieAuVelage,
      etapesCompatibles: etapes.filter((etape) => acte.medicamentId
        ? medicamentCompatibleAvecEtape(
          { etapes: etapes.map((e) => ({ id: e.id, reference: e.reference, medicaments: e.medicaments.map((m) => ({ medicamentId: m.medicament.id })) })) }, etape.id, acte.medicamentId,
        )
        : etape.medicaments.some((m) => nomVaccinComparable(m.medicament.nom) === nomVaccinComparable(acte.vaccin)))
        .map((e) => ({ id: e.id, label: e.label })),
      raison: raison ?? (acte.sourceType === "TRAITEMENT"
        ? "Cet acte provient d’un traitement vaccinal ancien sans rattachement structuré."
        : "L’étape du protocole n’a pas pu être déterminée avec certitude."),
    });
    // Les faits déjà structurés d'une autre gestation restent visibles sans couvrir ce cycle.
    for (const acte of interpretation.historique.filter((v) => !actesUtiles.includes(v))) {
      const cellule = cellules.get(acte.etapeProtocoleId!);
      if (cellule) cellule.historiquesAValider.push(versHistorique(acte, "Acte réel rattaché à une autre gestation : il ne couvre pas le cycle courant."));
    }
    if (interpretation.aConfirmer.length && etapes[0]) {
      for (const [id, cellule] of cellules) {
        cellules.set(id, cellule.statut === "FAIT" ? { ...cellule, prochaine: null }
          : { ...celluleVide(), rattachementProtocoleAutorise: false, historiquesAValider: cellule.historiquesAValider });
      }
      for (const acte of interpretation.aConfirmer) {
        const historique = versHistorique(acte);
        // Un acte sans étape compatible reste dans son historique source :
        // ne jamais l'attribuer artificiellement au premier vaccin du protocole.
        const cible = etapes.find((e) => historique.etapesCompatibles.some((c) => c.id === e.id));
        if (!cible) continue;
        const cellule = cellules.get(cible.id)!;
        cellules.set(cible.id, { ...cellule, aValider: true,
          historiquesAValider: [...cellule.historiquesAValider, historique] });
      }
    }
    return cellules;
  };

  if (protocole.configurationQuestionnaireJson != null) {
    for (const etape of etapes) {
      const faites = actesUtiles.filter((acte) => acte.etapeProtocoleId === etape.id).sort((a, b) => b.date.getTime() - a.date.getTime());
      cellules.set(etape.id, faites.length > 0
        ? { statut: "FAIT", date: faites[0].date, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [...faites].reverse().map(versActeCellule), prochaine: null }
        : { ...celluleVide(), rattachementProtocoleAutorise: eligible });
    }
    if (!eligible) marquerAbsence("HORS_CIBLE");
    if (eligible && acquisSansPreuve) marquerAbsence("ACQUIS_SANS_PREUVE");
    if (eligible) {
      const action = calculerActionVaccinale({
        date,
        dateNaissance: new Date(animal.danaisIso),
        dateVelagePrevue: animal.dateVelagePrevueIso ? new Date(animal.dateVelagePrevueIso) : null,
        etapes,
        vaccinations: actesUtiles,
        historiqueVaccinations: actesHistoriquesDuProtocole,
        statutProtocole,
        configurationQuestionnaireJson: protocole.configurationQuestionnaireJson,
        brancheInitialeId: statutEnregistre?.brancheInitialeId ?? null,
      });
      if (action.statut === "A_CONFIRMER" && !acquisSansPreuve) marquerAbsence("CALCUL_A_CONFIRMER");
      if (action.statut === "HORS_PROGRAMME" && action.etape) {
        const existante = cellules.get(action.etape.id) ?? celluleVide();
        if (existante.statut !== "FAIT") cellules.set(action.etape.id, { ...existante, horsProgramme: true });
      }
      if (action.etape && action.dateMin && action.dateMax) {
        const existante = cellules.get(action.etape.id) ?? celluleVide();
        const etapeGrille = etapes.find((item) => item.id === action.etape!.id);
        const preconisation = etapeGrille?.preconisations?.find((item) => item.id === action.preconisationId);
        const planning = { ...celluleDepuisPlanning(date, { debut: action.dateMin, fin: action.dateMax }), voie: preconisation?.voie ?? null, dose: preconisation?.dose ?? null, uniteDosage: preconisation?.unite ?? null };
        if (existante.statut === "FAIT" && planning.date) {
          cellules.set(action.etape.id, { ...existante, prochaine: { statut: planning.statut as Exclude<StatutCelluleGrille, "FAIT" | "VIDE">, date: planning.date, fenetre: planning.fenetre! } });
        } else cellules.set(action.etape.id, { ...planning, rattachementProtocoleAutorise: true });
      }
    }
    return finaliserHistorique();
  }

  if (!eligible) marquerAbsence("HORS_CIBLE");
  if (eligible && acquisSansPreuve) marquerAbsence("ACQUIS_SANS_PREUVE");
  if (eligible && statutProtocole === "A_CONFIRMER") marquerAbsence("CALCUL_A_CONFIRMER");
  let dateEtapePrecedente: Date | null = null;
  for (const etape of etapes) {
    const faites = actesUtiles.filter((acte) => acte.etapeProtocoleId === etape.id).sort((a, b) => b.date.getTime() - a.date.getTime());
    if (faites.length > 0) {
      // Une étape peut avoir plusieurs actes réels : ils sont tous conservés. Le DERNIER sert de
      // référence (étape suivante, ou prochain rappel d'une étape d'entretien à récurrence configurée).
      let prochaine: CelluleGrille["prochaine"] = null;
      if (etape.cycle !== "ENTRETIEN") {
        dateEtapePrecedente = faites[0].date;
      } else if (etape.recurrenceMois && etape.reference !== "VELAGE" && eligible) {
        const echeance = addMonths(faites[0].date, etape.recurrenceMois);
        const horsAge = protocole.ageMaxJours != null && echeance > addDays(new Date(animal.danaisIso), protocole.ageMaxJours);
        const suite = horsAge ? celluleVide() : celluleDepuisPlanning(date, { debut: echeance, fin: echeance });
        if (suite.statut !== "VIDE" && suite.statut !== "FAIT" && suite.date) prochaine = { statut: suite.statut, date: suite.date, fenetre: suite.fenetre ?? { debut: suite.date, fin: suite.date } };
      }
      cellules.set(etape.id, { statut: "FAIT", date: faites[0].date, aValider: false, rattachementProtocoleAutorise: true, historiquesAValider: [], actes: [...faites].reverse().map(versActeCellule), prochaine });
      continue;
    }
    if (!eligible) {
      const existante = cellules.get(etape.id) ?? celluleVide();
      cellules.set(etape.id, { ...celluleVide(), motifSansEcheance: existante.motifSansEcheance,
        raisonsHorsCible: existante.raisonsHorsCible });
      continue;
    }
    if (!etapePlanifiableSelonStatut(etape, statutProtocole)) {
      const existante = cellules.get(etape.id) ?? celluleVide();
      cellules.set(etape.id, { ...celluleVide(), rattachementProtocoleAutorise: eligible, motifSansEcheance: existante.motifSansEcheance });
      continue;
    }
    const fenetreCalculee = calculerFenetreEtape({
      etape,
      dateNaissance: new Date(animal.danaisIso),
      dateVelagePrevue: animal.dateVelagePrevueIso ? new Date(animal.dateVelagePrevueIso) : null,
      dateEtapePrecedente,
      ageMinJours: protocole.ageMinJours,
      ageMaxJours: protocole.ageMaxJours,
    });
    const fenetre = bornerFenetreInitialeAuVelage(
      fenetreCalculee,
      animal.dateVelagePrevueIso ? new Date(animal.dateVelagePrevueIso) : null,
      protocoleLieAuVelage && etape.cycle !== "ENTRETIEN",
    );
    const cellule = fenetre ? celluleDepuisPlanning(date, fenetre) : celluleVide();
    const existante = cellules.get(etape.id) ?? celluleVide();
    cellules.set(etape.id, { ...cellule, rattachementProtocoleAutorise: eligible,
      motifSansEcheance: cellule.statut === "VIDE"
        ? (existante.motifSansEcheance ?? (etape.id === premiereInitiale?.id ? "CALCUL_A_CONFIRMER" : undefined))
        : undefined });
  }

  return finaliserHistorique();
}

export function construireGrilleVaccinale(
  animaux: readonly AnimalGrille[],
  protocoles: readonly ProtocoleGrille[],
  vaccinsPharmacie: readonly VaccinPharmacieGrille[],
  date = new Date()
): { blocs: BlocVaccinGrille[]; lignes: LigneGrille[] } {
  const blocs = construireBlocsVaccinaux(protocoles, vaccinsPharmacie);
  const protocolesAvecEtapes = protocoles.filter((p) => p.etapes.length > 0);

  const lignes: LigneGrille[] = animaux.map((animal) => {
    const cellules: Record<string, CelluleGrille> = {};
    for (const protocole of protocolesAvecEtapes) {
      for (const [etapeId, cellule] of celluleProtocole(animal, protocole, protocolesAvecEtapes, date)) {
        cellules[etapeId] = cellule;
      }
    }
    // Vaccins de pharmacie sans protocole configuré : une seule sous-colonne, "fait" si un acte
    // existe, sinon vide (aucune fenêtre calculable sans étape).
    for (const bloc of blocs) {
      if (bloc.sousColonnes.length !== 1 || cellules[bloc.sousColonnes[0].id]) continue;
      const sousColonne = bloc.sousColonnes[0];
      const idsDuNom = new Set([
        ...vaccinsPharmacie.filter((m) => nomVaccinComparable(m.nom) === nomVaccinComparable(bloc.nom)).map((m) => m.medicamentId),
        ...protocoles.flatMap((p) => p.etapes.flatMap((e) => e.medicaments.map((m) => m.medicament))).filter((m) => nomVaccinComparable(m.nom) === nomVaccinComparable(bloc.nom)).map((m) => m.id),
      ]);
      const actes = animal.actes.filter((acte) => acte.statut === "FAIT" && (acte.medicamentId != null
        ? acte.medicamentId === bloc.cle
        : idsDuNom.size === 1 && nomVaccinComparable(acte.vaccin) === nomVaccinComparable(bloc.nom))).sort((a, b) => b.date.getTime() - a.date.getTime());
      cellules[sousColonne.id] = actes[0]
        ? { statut: "FAIT", date: actes[0].date, aValider: false, rattachementProtocoleAutorise: false, historiquesAValider: [], actes: [...actes].reverse().map(versActeCellule), prochaine: null }
        : celluleVide();
    }
    return {
      animalId: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nom,
      mereNutrav: animal.mereNutrav ?? null,
      mereNom: animal.mereNom ?? null,
      mereLiee: animal.mereLiee === true,
      sexe: animal.sexe,
      danaisIso: animal.danaisIso,
      gestationId: animal.gestationId,
      dateVelagePrevueIso: animal.dateVelagePrevueIso,
      cellules,
      actes: animal.actes.map(versActeCellule),
    };
  });

  return { blocs, lignes };
}

/**
 * Action vaccinale prévue pour un animal : donnée de base du futur bandeau de travail. Dérivée de
 * la grille (donc du même planner, sans deuxième logique) ; ne contient aucune règle supplémentaire.
 */
export interface ActionPrevue {
  animalId: string;
  nutrav: string;
  nom: string | null;
  medicamentId: string | null;
  medicamentNom: string;
  protocoleId: string | null;
  etapeId: string;
  etapeLabel: string;
  typeEtape: "INITIAL" | "ENTRETIEN";
  statut: "PREVU" | "BIENTOT" | "A_FAIRE" | "EN_RETARD";
  dateMin: Date;
  dateMax: Date;
  /** Date de vêlage prévue de référence pour tout le parcours lié au vêlage. */
  dateVelageReference: Date | null;
  /** Historique réel de CE médicament pour cet animal (tous les actes, aucun filtre d'année). */
  historique: ActeCellule[];
  voie: string | null;
  dose: number | null;
  unite: string | null;
}

export function extraireActionsPrevues(grille: { blocs: BlocVaccinGrille[]; lignes: LigneGrille[] }): ActionPrevue[] {
  const actions: ActionPrevue[] = [];
  for (const ligne of grille.lignes) {
    for (const bloc of grille.blocs) {
      for (const sousColonne of bloc.sousColonnes) {
        const cellule = ligne.cellules[sousColonne.id];
        if (!cellule) continue;
        const planning = cellule.statut === "FAIT"
          ? cellule.prochaine
          : cellule.statut === "VIDE" || !cellule.fenetre ? null : { statut: cellule.statut, fenetre: cellule.fenetre };
        if (!planning) continue;
        const etape = bloc.etapes.find((item) => item.id === sousColonne.id);
        const medicamentId = sousColonne.medicamentId ?? bloc.medicamentId;
        const nom = sousColonne.medicamentNom ?? bloc.nom;
        actions.push({
          animalId: ligne.animalId,
          nutrav: ligne.nutrav,
          nom: ligne.nom,
          medicamentId,
          medicamentNom: nom,
          protocoleId: sousColonne.protocoleId,
          etapeId: sousColonne.id,
          etapeLabel: sousColonne.label,
          typeEtape: etape?.cycle === "ENTRETIEN" ? "ENTRETIEN" : "INITIAL",
          statut: planning.statut,
          dateMin: planning.fenetre.debut,
          dateMax: planning.fenetre.fin,
          dateVelageReference: bloc.protocoleLieAuVelage && ligne.dateVelagePrevueIso ? new Date(ligne.dateVelagePrevueIso) : null,
          historique: ligne.actes.filter((acte) => acte.medicamentId != null ? acte.medicamentId === medicamentId : acte.vaccin.trim().toUpperCase() === nom.trim().toUpperCase()),
          voie: sousColonne.voie,
          dose: sousColonne.dose,
          unite: sousColonne.uniteDosage,
        });
      }
    }
  }
  return actions;
}
