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
import type { ActeVaccination } from "./vaccine-acts.ts";

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
}

export type StatutCelluleGrille = "FAIT" | "BIENTOT" | "A_FAIRE" | "EN_RETARD" | "VIDE";

export interface CelluleGrille {
  statut: StatutCelluleGrille;
  date: Date | null;
  aValider: boolean;
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
    });
  }

  return [...blocs.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function celluleVide(): CelluleGrille {
  return { statut: "VIDE", date: null, aValider: false };
}

function celluleDepuisPlanning(date: Date, fenetre: { debut: Date; fin: Date }): CelluleGrille {
  const statut = statutPlanningVaccin(date, fenetre.debut, fenetre.fin);
  if (statut === "TROP_TOT") return celluleVide();
  if (statut === "EN_RETARD_LEGER" || statut === "EN_RETARD") return { statut: "EN_RETARD", date: fenetre.fin, aValider: false };
  // Bientôt (fenêtre pas encore ouverte mais proche) reste distinct d'à faire (fenêtre ouverte,
  // à faire maintenant) : même donnée du moteur (statutPlanningVaccin), affichage plus fin.
  if (statut === "A_PREVOIR") return { statut: "BIENTOT", date: fenetre.debut, aValider: false };
  return { statut: "A_FAIRE", date: fenetre.fin, aValider: false };
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
      cellules.set(etape.id, { statut: "FAIT", date: faites[0].date, aValider: false });
      if (etape.cycle !== "ENTRETIEN") dateEtapePrecedente = faites[0].date;
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
    cellules.set(etape.id, fenetre ? celluleDepuisPlanning(date, fenetre) : celluleVide());
  }

  // Avertissement discret sur la première sous-colonne pour ce qui reste ambigu après le
  // rattachement automatique ci-dessus, seulement si elle n'est pas déjà cochée faite.
  const aVerifier = vaccinationsSansEtapeFiable(animal.actes, correspondanceHistorique)
    .filter((acte) => acte !== acteInfere).length > 0;
  const premiereEtape = etapes[0];
  if (aVerifier && premiereEtape) {
    const cellule = cellules.get(premiereEtape.id);
    if (cellule && cellule.statut !== "FAIT") cellules.set(premiereEtape.id, { ...cellule, aValider: true });
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
      cellules[sousColonne.id] = actes[0] ? { statut: "FAIT", date: actes[0].date, aValider: false } : celluleVide();
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
    };
  });

  return { blocs, lignes };
}
