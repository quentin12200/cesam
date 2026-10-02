/**
 * Grille vaccinale « esprit Excel » : un bloc de colonnes par vaccin, une sous-colonne par
 * étape réelle du protocole (rien n'est inventé : sans protocole configuré, un vaccin garde
 * une seule sous-colonne, comme avant).
 *
 * Présentation seule : cette fonction n'ajoute aucune règle métier. Elle appelle les mêmes
 * primitives déjà fiables (calculerFenetreEtape, statutPlanningVaccin, rattacherPrimoNonLiee,
 * vaccinationsSansEtapeFiable, vaccinationAppartientAuCycleCourant, estAnimalConcerneParProtocole)
 * une fois par étape au lieu d'une fois pour « la prochaine action » seulement.
 */
import { calculerFenetreEtape, type EtapeVaccinaleConfig } from "./vaccine-planner.ts";
import { statutPlanningVaccin } from "./vaccine-planning-status.ts";
import { rattacherInjectionOrpheline, vaccinationsSansEtapeFiable } from "./vaccine-history.ts";
import { vaccinationAppartientAuCycleCourant } from "./vaccination-session.ts";
import { estAnimalConcerneParProtocole } from "./vaccine-eligibility.ts";
import { addDays, addMonths } from "date-fns";
import type { ActeVaccination } from "./vaccine-acts.ts";
import { medicamentCompatibleAvecEtape } from "./vaccine-attachment.ts";

export interface EtapeGrille extends EtapeVaccinaleConfig {
  medicamentId: string | null;
  medicamentNom: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  medicaments: readonly { medicament: { id: string; nom: string } }[];
}

export interface ProtocoleGrille {
  id: string;
  nom: string;
  label: string;
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
  sexe: string;
  danaisIso: string;
  categorie: string;
  nombreVelages: number;
  groupeNom: string | null;
  gestationId: string | null;
  dateVelagePrevueIso: string | null;
  /** Historique déjà fusionné (Vaccination + Traitement VACCIN), voir lib/vaccine-acts.ts. */
  actes: readonly ActeVaccination[];
}

export interface SousColonneGrille {
  id: string;
  label: string;
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

export interface CelluleGrille {
  statut: StatutCelluleGrille;
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
    if (medicament) medicamentsCouverts.add(medicament.id);
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
        protocoleLieAuVelage: protocole.etapes.some((etape) => etape.reference === "VELAGE"),
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
  const eligible = estAnimalConcerneParProtocole(
    { categorie: animal.categorie, sexbov: animal.sexe, groupeNom: animal.groupeNom, nombreVelages: animal.nombreVelages, gestation: Boolean(animal.gestationId) },
    protocole
  );

  const protocoleLieAuVelage = etapes.some((etape) => etape.reference === "VELAGE");
  const actesDuProtocole = animal.actes.filter(
    (acte) => acte.protocoleId === protocole.id && vaccinationAppartientAuCycleCourant(protocoleLieAuVelage, acte.gestationId, animal.gestationId)
  );
  const etapesInitiales = etapes.filter((etape) => etape.cycle !== "ENTRETIEN");
  const medicament = medicamentPrincipal(protocole);
  const medicamentPartage = medicament
    ? protocoles.some((autre) => autre.id !== protocole.id && autre.etapes.some((etape) => etape.medicamentId === medicament.id))
    : false;
  // Ambiguïté historique (acte sans étape fiable, ex: saisi en Traitement libre) : calculée avant
  // la boucle pour pouvoir rattacher automatiquement ce qui n'est pas ambigu (voir ci-dessous) et
  // avertir discrètement sur le reste.
  const correspondanceHistorique = {
    id: protocole.id,
    noms: [protocole.nom, protocole.label, medicament?.nom].filter((n): n is string => Boolean(n)),
    medicamentIds: medicament ? [medicament.id] : [],
    etapeIds: etapes.map((e) => e.id),
  };
  // Centralisé dans lib/vaccine-history.ts : utilisé identiquement par la grille et par la
  // préparation de séance (lib/vaccine-preparation-data.ts), pour qu'elles répondent pareil.
  const acteInfere = rattacherInjectionOrpheline(
    animal.actes,
    { ...correspondanceHistorique, etapes: protocole.etapes },
    { protocoleLieAuVelage, medicamentPartage }
  );
  const actesUtiles = acteInfere
    ? [...actesDuProtocole, { ...acteInfere, protocoleId: protocole.id, etapeProtocoleId: etapesInitiales[0]?.id ?? null }]
    : actesDuProtocole;

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
    if (!eligible) { cellules.set(etape.id, celluleVide()); continue; }
    const fenetre = calculerFenetreEtape({
      etape,
      dateNaissance: new Date(animal.danaisIso),
      dateVelagePrevue: animal.dateVelagePrevueIso ? new Date(animal.dateVelagePrevueIso) : null,
      dateEtapePrecedente,
      ageMinJours: protocole.ageMinJours,
      ageMaxJours: protocole.ageMaxJours,
    });
    const cellule = fenetre ? celluleDepuisPlanning(date, fenetre) : celluleVide();
    cellules.set(etape.id, { ...cellule, rattachementProtocoleAutorise: eligible });
  }

  // Avertissement discret sur la première sous-colonne pour ce qui reste ambigu après le
  // rattachement automatique ci-dessus, seulement si elle n'est pas déjà cochée faite.
  const actesAVerifier = vaccinationsSansEtapeFiable(animal.actes, correspondanceHistorique)
    .filter((acte) => acte !== acteInfere);
  const premiereEtape = etapes[0];
  if (actesAVerifier.length > 0 && premiereEtape) {
    const cellule = cellules.get(premiereEtape.id);
    if (cellule && cellule.statut !== "FAIT") cellules.set(premiereEtape.id, {
      ...cellule,
      aValider: true,
      historiquesAValider: actesAVerifier.map((acte) => ({
        sourceType: acte.sourceType ?? "VACCINATION",
        sourceId: acte.sourceId ?? null,
        date: acte.date,
        vaccin: acte.vaccin,
        medicamentId: acte.medicamentId,
        protocoleId: protocole.id,
        protocoleNom: protocole.label || protocole.nom,
        gestationId: acte.gestationId,
        protocoleLieAuVelage,
        etapesCompatibles: etapes
          .filter((etape) => !acte.medicamentId || medicamentCompatibleAvecEtape(
            { etapes: protocole.etapes.map((item) => ({ id: item.id, reference: item.reference, medicaments: item.medicaments.map((liaison) => ({ medicamentId: liaison.medicament.id })) })) },
            etape.id,
            acte.medicamentId,
          ))
          .map((etape) => ({ id: etape.id, label: etape.label })),
        raison: acte.sourceType === "TRAITEMENT"
          ? "Cet acte provient d’un traitement vaccinal ancien sans rattachement structuré."
          : "L’étape du protocole n’a pas pu être déterminée avec certitude.",
      })),
    });
  }

  return cellules;
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
      const actes = animal.actes.filter((acte) => acte.medicamentId === bloc.cle).sort((a, b) => b.date.getTime() - a.date.getTime());
      cellules[sousColonne.id] = actes[0]
        ? { statut: "FAIT", date: actes[0].date, aValider: false, rattachementProtocoleAutorise: false, historiquesAValider: [], actes: [...actes].reverse().map(versActeCellule), prochaine: null }
        : celluleVide();
    }
    return {
      animalId: animal.id,
      nutrav: animal.nutrav,
      nom: animal.nom,
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
  /** Date de vêlage prévue de référence, seulement pour une étape basée sur le vêlage. */
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
          dateVelageReference: etape?.reference === "VELAGE" && ligne.dateVelagePrevueIso ? new Date(ligne.dateVelagePrevueIso) : null,
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