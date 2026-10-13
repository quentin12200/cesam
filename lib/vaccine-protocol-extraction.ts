import type { RoleEtapeProtocole } from "./vaccine-protocol-name.ts";
import { roleEtapeProtocole } from "./vaccine-protocol-name.ts";
import { cleVaccinaleAnimalJour, medicamentsVaccinauxParAnimalEtJour, vaccinationGeneriqueCouverteParTraitementsCertains, type TraitementVaccinalIdentifie } from "./vaccine-acts.ts";

export type EtapeExtractionVaccin = {
  id: string;
  label: string;
  cycle: string;
  medicamentIds: readonly string[];
  medicamentsConnus?: readonly { id: string; nom: string }[];
};

export type ActeExtractionVaccin = {
  id: string;
  animalId: string;
  medicamentId: string | null;
  etapeId: string | null;
  date?: Date | null;
  vaccin?: string | null;
};

export type ActeAExtraire = {
  id: string;
  animalId: string;
  etapeCibleId: string | null;
  medicamentIdAEnregistrer?: string;
};

export type CauseDiagnosticExtraction =
  | "AUCUN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR"
  | "UN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR"
  | "PLUSIEURS_TRAITEMENTS_VACCIN_CERTAINS_MEME_JOUR"
  | "COUVERTURE_PARTIELLE_MEDICAMENTS_ETAPE"
  | "PLUSIEURS_VACCINATIONS_GENERIQUES_MEME_JOUR"
  | "ETAPE_LEGACY_ABSENTE"
  | "ETAPE_LEGACY_UN_MEDICAMENT"
  | "ETAPE_LEGACY_PLUSIEURS_MEDICAMENTS"
  | "AUTRE_INCOHERENCE";

export interface ExempleDiagnosticExtraction {
  source: "VACCINATION" | "TRAITEMENT";
  acteId: string;
  animalId: string;
  date: string | null;
  vaccinationId: string | null;
  ancienneEtape: { id: string; label: string | null } | null;
  medicamentIdVaccination: string | null;
  medicamentsPossiblesEtape: string[];
  medicamentsReelsJour: string[];
  nombreVaccinationsGeneriquesJour: number;
}

export interface DiagnosticExtractionLegacy {
  totalAmbigus: number;
  vaccinationsAmbigues: number;
  autresActesAmbigus: number;
  repartition: Array<{
    cause: CauseDiagnosticExtraction;
    libelle: string;
    nombre: number;
    exemples: ExempleDiagnosticExtraction[];
  }>;
}

const libellesDiagnostic: Record<CauseDiagnosticExtraction, string> = {
  AUCUN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR: "aucun Traitement VACCIN certain le même animal/jour",
  UN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR: "un seul Traitement VACCIN certain le même animal/jour",
  PLUSIEURS_TRAITEMENTS_VACCIN_CERTAINS_MEME_JOUR: "plusieurs Traitement VACCIN certains le même animal/jour",
  COUVERTURE_PARTIELLE_MEDICAMENTS_ETAPE: "médicaments réels présents mais couverture partielle des médicaments possibles de l’étape legacy",
  PLUSIEURS_VACCINATIONS_GENERIQUES_MEME_JOUR: "plusieurs Vaccination génériques le même animal/jour",
  ETAPE_LEGACY_ABSENTE: "étape legacy absente",
  ETAPE_LEGACY_UN_MEDICAMENT: "étape legacy avec un seul médicament",
  ETAPE_LEGACY_PLUSIEURS_MEDICAMENTS: "étape legacy avec plusieurs médicaments",
  AUTRE_INCOHERENCE: "autre incohérence",
};

export type PlanExtractionVaccin =
  | { possible: false; raison: string; actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }>; diagnostic: DiagnosticExtractionLegacy; resolusAutomatiquement: number }
  | { possible: true; vaccinations: ActeAExtraire[]; traitements: ActeAExtraire[]; vaccinationsGeneriquesANeutraliser: string[]; traitementsDoublonsADetacher: string[]; resolusAutomatiquement: number };

export function resoudreLegacyParMedicament<T extends { id: string }>(candidats: readonly T[]):
  | { type: "AUCUN" }
  | { type: "UNIQUE"; protocole: T }
  | { type: "AMBIGU"; protocoleIds: string[] } {
  if (candidats.length === 0) return { type: "AUCUN" };
  if (candidats.length === 1) return { type: "UNIQUE", protocole: candidats[0] };
  return { type: "AMBIGU", protocoleIds: candidats.map((protocole) => protocole.id) };
}

function classerActe(
  acte: ActeExtractionVaccin,
  medicamentId: string,
  etapes: ReadonlyMap<string, EtapeExtractionVaccin>,
  medicamentsLegacy: ReadonlySet<string>,
  medicamentsParNom: ReadonlyMap<string, ReadonlySet<string>>,
  medicamentsReelsParJour: ReadonlyMap<string, ReadonlySet<string>>,
): "CIBLE" | "AUTRE" | "AMBIGU" {
  if (acte.medicamentId) return acte.medicamentId === medicamentId ? "CIBLE" : "AUTRE";
  const medicamentHistorique = medicamentDepuisNomHistorique(acte.vaccin, medicamentsParNom);
  if (medicamentHistorique) return medicamentHistorique === medicamentId ? "CIBLE" : "AUTRE";
  if (acte.date) {
    const identitesReelles = identitesReellesCompatibles(acte, medicamentsLegacy, medicamentsReelsParJour);
    if (identitesReelles.length === 1) return identitesReelles[0] === medicamentId ? "CIBLE" : "AUTRE";
    if (identitesReelles.length > 1) return "AMBIGU";
  }
  if (!acte.etapeId) return "AMBIGU";
  const medicaments = new Set(etapes.get(acte.etapeId)?.medicamentIds ?? []);
  if (medicaments.size === 1) return medicaments.has(medicamentId) ? "CIBLE" : "AUTRE";
  if (medicaments.size > 1 && !medicaments.has(medicamentId)) return "AUTRE";
  return "AMBIGU";
}

function normaliserNomMedicament(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function indexerMedicamentsParNom(etapes: readonly EtapeExtractionVaccin[]): Map<string, Set<string>> {
  const resultat = new Map<string, Set<string>>();
  for (const medicament of etapes.flatMap((etape) => etape.medicamentsConnus ?? [])) {
    const nom = normaliserNomMedicament(medicament.nom);
    if (!nom) continue;
    const ids = resultat.get(nom) ?? new Set<string>();
    ids.add(medicament.id);
    resultat.set(nom, ids);
  }
  return resultat;
}

function medicamentDepuisNomHistorique(
  vaccin: string | null | undefined,
  medicamentsParNom: ReadonlyMap<string, ReadonlySet<string>>,
): string | null {
  if (!vaccin) return null;
  const ids = medicamentsParNom.get(normaliserNomMedicament(vaccin));
  return ids?.size === 1 ? [...ids][0] : null;
}

function identitesReellesCompatibles(
  acte: ActeExtractionVaccin,
  medicamentsLegacy: ReadonlySet<string>,
  medicamentsReelsParJour: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  if (!acte.date) return [];
  return [...(medicamentsReelsParJour.get(cleVaccinaleAnimalJour(acte.animalId, acte.date)) ?? [])]
    .filter((id) => medicamentsLegacy.has(id));
}

function etapeCible(
  acte: ActeExtractionVaccin,
  etapes: ReadonlyMap<string, EtapeExtractionVaccin>,
  idsCibles: Record<RoleEtapeProtocole, string | null>,
): string | null {
  if (!acte.etapeId) return null;
  const etape = etapes.get(acte.etapeId);
  if (!etape) return null;
  const role = roleEtapeProtocole(etape);
  return role ? idsCibles[role] : null;
}

function construireDiagnosticExtraction({
  actesAmbigus,
  vaccinations,
  traitements,
  parId,
  medicamentsReelsParJour,
  vaccinationsGeneriquesParJour,
}: {
  actesAmbigus: readonly { source: "VACCINATION" | "TRAITEMENT"; id: string }[];
  vaccinations: readonly ActeExtractionVaccin[];
  traitements: readonly ActeExtractionVaccin[];
  parId: ReadonlyMap<string, EtapeExtractionVaccin>;
  medicamentsReelsParJour: ReadonlyMap<string, ReadonlySet<string>>;
  vaccinationsGeneriquesParJour: ReadonlyMap<string, number>;
}): DiagnosticExtractionLegacy {
  const groupes = new Map<CauseDiagnosticExtraction, ExempleDiagnosticExtraction[]>();
  const nombres = new Map<CauseDiagnosticExtraction, number>();
  let vaccinationsAmbigues = 0;

  for (const ambigu of actesAmbigus) {
    const acte = (ambigu.source === "VACCINATION" ? vaccinations : traitements).find((candidate) => candidate.id === ambigu.id);
    if (!acte) continue;
    if (ambigu.source === "VACCINATION") vaccinationsAmbigues += 1;
    const etape = acte.etapeId ? parId.get(acte.etapeId) ?? null : null;
    const medicamentsPossibles = [...new Set(etape?.medicamentIds ?? [])].sort();
    const cle = acte.date ? cleVaccinaleAnimalJour(acte.animalId, acte.date) : null;
    const medicamentsReels = [...(cle ? medicamentsReelsParJour.get(cle) ?? [] : [])].sort();
    const nombreGeneriques = cle ? vaccinationsGeneriquesParJour.get(cle) ?? 0 : 0;
    const medicamentsCouverts = medicamentsPossibles.filter((id) => medicamentsReels.includes(id));

    let cause: CauseDiagnosticExtraction;
    if (ambigu.source !== "VACCINATION") cause = "AUTRE_INCOHERENCE";
    else if (nombreGeneriques > 1) cause = "PLUSIEURS_VACCINATIONS_GENERIQUES_MEME_JOUR";
    else if (!etape) cause = "ETAPE_LEGACY_ABSENTE";
    else if (!acte.date) cause = medicamentsPossibles.length === 1
      ? "ETAPE_LEGACY_UN_MEDICAMENT"
      : medicamentsPossibles.length > 1
        ? "ETAPE_LEGACY_PLUSIEURS_MEDICAMENTS"
        : "AUTRE_INCOHERENCE";
    else if (medicamentsReels.length === 0) cause = "AUCUN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR";
    else if (medicamentsReels.length === 1) cause = "UN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR";
    else if (medicamentsCouverts.length > 0 && medicamentsCouverts.length < medicamentsPossibles.length) cause = "COUVERTURE_PARTIELLE_MEDICAMENTS_ETAPE";
    else if (medicamentsReels.length > 1) cause = "PLUSIEURS_TRAITEMENTS_VACCIN_CERTAINS_MEME_JOUR";
    else cause = "AUTRE_INCOHERENCE";

    nombres.set(cause, (nombres.get(cause) ?? 0) + 1);
    const exemples = groupes.get(cause) ?? [];
    if (exemples.length < 5) {
      exemples.push({
        source: ambigu.source,
        acteId: acte.id,
        animalId: acte.animalId,
        date: acte.date?.toISOString() ?? null,
        vaccinationId: ambigu.source === "VACCINATION" ? acte.id : null,
        ancienneEtape: acte.etapeId ? { id: acte.etapeId, label: etape?.label ?? null } : null,
        medicamentIdVaccination: ambigu.source === "VACCINATION" ? acte.medicamentId : null,
        medicamentsPossiblesEtape: medicamentsPossibles,
        medicamentsReelsJour: medicamentsReels,
        nombreVaccinationsGeneriquesJour: nombreGeneriques,
      });
      groupes.set(cause, exemples);
    }
  }

  return {
    totalAmbigus: actesAmbigus.length,
    vaccinationsAmbigues,
    autresActesAmbigus: actesAmbigus.length - vaccinationsAmbigues,
    repartition: [...nombres.entries()].map(([cause, nombre]) => ({
      cause,
      libelle: libellesDiagnostic[cause],
      nombre,
      exemples: groupes.get(cause) ?? [],
    })),
  };
}

/**
 * Décide sans heuristique textuelle sur le médicament : l'identité vient du medicamentId réel,
 * ou, à défaut seulement, de l'unique médicament lié à l'étape historique.
 */
export function planifierExtractionVaccin({
  medicamentId,
  etapes,
  vaccinations,
  traitements,
  traitementsVaccinauxReels = [],
  idsCibles,
}: {
  medicamentId: string;
  etapes: readonly EtapeExtractionVaccin[];
  vaccinations: readonly ActeExtractionVaccin[];
  traitements: readonly ActeExtractionVaccin[];
  traitementsVaccinauxReels?: readonly TraitementVaccinalIdentifie[];
  idsCibles: Record<RoleEtapeProtocole, string | null>;
}): PlanExtractionVaccin {
  const parId = new Map(etapes.map((etape) => [etape.id, etape]));
  const medicamentsLegacy = new Set(etapes.flatMap((etape) => etape.medicamentIds));
  const medicamentsParNom = indexerMedicamentsParNom(etapes);
  const medicamentsReelsParJour = medicamentsVaccinauxParAnimalEtJour(traitementsVaccinauxReels);
  const vaccinationsGeneriquesParJour = new Map<string, number>();
  for (const vaccination of vaccinations) {
    if (vaccination.medicamentId || !vaccination.date) continue;
    const cle = cleVaccinaleAnimalJour(vaccination.animalId, vaccination.date);
    vaccinationsGeneriquesParJour.set(cle, (vaccinationsGeneriquesParJour.get(cle) ?? 0) + 1);
  }
  const vaccinationsGeneriquesANeutraliser: string[] = [];
  const actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }> = [];
  let resolusAutomatiquement = 0;
  const selectionner = (source: "VACCINATION" | "TRAITEMENT", actes: readonly ActeExtractionVaccin[]) => actes.flatMap((acte) => {
    const medicamentHistorique = source === "VACCINATION" && !acte.medicamentId
      ? medicamentDepuisNomHistorique(acte.vaccin, medicamentsParNom)
      : null;
    if (source === "VACCINATION" && !acte.medicamentId && !medicamentHistorique && acte.date) {
      const cle = cleVaccinaleAnimalJour(acte.animalId, acte.date);
      const medicamentsPossibles = acte.etapeId
        ? new Set(parId.get(acte.etapeId)?.medicamentIds ?? [])
        : medicamentsLegacy;
      const medicamentsReels = medicamentsReelsParJour.get(cle) ?? new Set<string>();
      if (vaccinationGeneriqueCouverteParTraitementsCertains(
        vaccinationsGeneriquesParJour.get(cle) ?? 0,
        medicamentsPossibles,
        medicamentsReels,
      )) {
        vaccinationsGeneriquesANeutraliser.push(acte.id);
        resolusAutomatiquement += 1;
        return [];
      }
    }
    const resolvableParHistorique = !acte.medicamentId && Boolean(medicamentHistorique
      || identitesReellesCompatibles(acte, medicamentsLegacy, medicamentsReelsParJour).length === 1);
    const classement = classerActe(acte, medicamentId, parId, medicamentsLegacy, medicamentsParNom, medicamentsReelsParJour);
    if (resolvableParHistorique && classement !== "AMBIGU") resolusAutomatiquement += 1;
    if (classement === "AMBIGU") {
      actesAmbigus.push({ source, id: acte.id });
      return [];
    }
    if (classement === "AUTRE") return [];
    const selection = { id: acte.id, animalId: acte.animalId, etapeCibleId: etapeCible(acte, parId, idsCibles) };
    return [medicamentHistorique ? { ...selection, medicamentIdAEnregistrer: medicamentHistorique } : selection];
  });
  const vaccinationsAExtraire = selectionner("VACCINATION", vaccinations);
  const traitementsAExtraireBruts = selectionner("TRAITEMENT", traitements);
  if (actesAmbigus.length > 0) {
    return {
      possible: false,
      raison: `${actesAmbigus.length} acte(s) restent réellement ambigus après vérification de l’historique médicamenteux.`,
      actesAmbigus,
      diagnostic: construireDiagnosticExtraction({
        actesAmbigus,
        vaccinations,
        traitements,
        parId,
        medicamentsReelsParJour,
        vaccinationsGeneriquesParJour,
      }),
      resolusAutomatiquement,
    };
  }
  const vaccinationsCiblesParJour = new Set(vaccinationsAExtraire.flatMap((selection) => {
    const acte = vaccinations.find((candidate) => candidate.id === selection.id);
    return acte?.date ? [cleVaccinaleAnimalJour(acte.animalId, acte.date)] : [];
  }));
  const traitementsDoublonsADetacher: string[] = [];
  const traitementsAExtraire = traitementsAExtraireBruts.filter((selection) => {
    const acte = traitements.find((candidate) => candidate.id === selection.id);
    const doublon = Boolean(acte?.date && vaccinationsCiblesParJour.has(cleVaccinaleAnimalJour(acte.animalId, acte.date)));
    if (doublon) traitementsDoublonsADetacher.push(selection.id);
    return !doublon;
  });
  return { possible: true, vaccinations: vaccinationsAExtraire, traitements: traitementsAExtraire, vaccinationsGeneriquesANeutraliser, traitementsDoublonsADetacher, resolusAutomatiquement };
}
