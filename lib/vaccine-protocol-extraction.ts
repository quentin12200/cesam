import type { RoleEtapeProtocole } from "./vaccine-protocol-name.ts";
import { roleEtapeProtocole } from "./vaccine-protocol-name.ts";
import { cleVaccinaleAnimalJour, medicamentsVaccinauxParAnimalEtJour, type TraitementVaccinalIdentifie } from "./vaccine-acts.ts";

export type EtapeExtractionVaccin = {
  id: string;
  label: string;
  cycle: string;
  medicamentIds: readonly string[];
};

export type ActeExtractionVaccin = {
  id: string;
  animalId: string;
  medicamentId: string | null;
  etapeId: string | null;
  date?: Date | null;
};

export type ActeAExtraire = {
  id: string;
  animalId: string;
  etapeCibleId: string | null;
};

export type PlanExtractionVaccin =
  | { possible: false; raison: string; actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }>; resolusAutomatiquement: number }
  | { possible: true; vaccinations: ActeAExtraire[]; traitements: ActeAExtraire[]; traitementsDoublonsADetacher: string[]; resolusAutomatiquement: number };

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
  medicamentsReelsParJour: ReadonlyMap<string, ReadonlySet<string>>,
): "CIBLE" | "AUTRE" | "AMBIGU" {
  if (acte.medicamentId) return acte.medicamentId === medicamentId ? "CIBLE" : "AUTRE";
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
  const medicamentsReelsParJour = medicamentsVaccinauxParAnimalEtJour(traitementsVaccinauxReels);
  const actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }> = [];
  let resolusAutomatiquement = 0;
  const selectionner = (source: "VACCINATION" | "TRAITEMENT", actes: readonly ActeExtractionVaccin[]) => actes.flatMap((acte) => {
    const resolvableParHistorique = !acte.medicamentId
      && identitesReellesCompatibles(acte, medicamentsLegacy, medicamentsReelsParJour).length === 1;
    const classement = classerActe(acte, medicamentId, parId, medicamentsLegacy, medicamentsReelsParJour);
    if (resolvableParHistorique && classement !== "AMBIGU") resolusAutomatiquement += 1;
    if (classement === "AMBIGU") {
      actesAmbigus.push({ source, id: acte.id });
      return [];
    }
    if (classement === "AUTRE") return [];
    return [{ id: acte.id, animalId: acte.animalId, etapeCibleId: etapeCible(acte, parId, idsCibles) }];
  });
  const vaccinationsAExtraire = selectionner("VACCINATION", vaccinations);
  const traitementsAExtraireBruts = selectionner("TRAITEMENT", traitements);
  if (actesAmbigus.length > 0) {
    return {
      possible: false,
      raison: `${actesAmbigus.length} acte(s) restent réellement ambigus après vérification de l’historique médicamenteux.`,
      actesAmbigus,
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
  return { possible: true, vaccinations: vaccinationsAExtraire, traitements: traitementsAExtraire, traitementsDoublonsADetacher, resolusAutomatiquement };
}
