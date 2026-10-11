import type { RoleEtapeProtocole } from "./vaccine-protocol-name.ts";
import { roleEtapeProtocole } from "./vaccine-protocol-name.ts";

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
};

export type ActeAExtraire = {
  id: string;
  animalId: string;
  etapeCibleId: string | null;
};

export type PlanExtractionVaccin =
  | { possible: false; raison: string; actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }> }
  | { possible: true; vaccinations: ActeAExtraire[]; traitements: ActeAExtraire[] };

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
): "CIBLE" | "AUTRE" | "AMBIGU" {
  if (acte.medicamentId) return acte.medicamentId === medicamentId ? "CIBLE" : "AUTRE";
  if (!acte.etapeId) return "AMBIGU";
  const medicaments = new Set(etapes.get(acte.etapeId)?.medicamentIds ?? []);
  if (medicaments.size === 1) return medicaments.has(medicamentId) ? "CIBLE" : "AUTRE";
  if (medicaments.size > 1 && !medicaments.has(medicamentId)) return "AUTRE";
  return "AMBIGU";
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
  idsCibles,
}: {
  medicamentId: string;
  etapes: readonly EtapeExtractionVaccin[];
  vaccinations: readonly ActeExtractionVaccin[];
  traitements: readonly ActeExtractionVaccin[];
  idsCibles: Record<RoleEtapeProtocole, string | null>;
}): PlanExtractionVaccin {
  const parId = new Map(etapes.map((etape) => [etape.id, etape]));
  const actesAmbigus: Array<{ source: "VACCINATION" | "TRAITEMENT"; id: string }> = [];
  const selectionner = (source: "VACCINATION" | "TRAITEMENT", actes: readonly ActeExtractionVaccin[]) => actes.flatMap((acte) => {
    const classement = classerActe(acte, medicamentId, parId);
    if (classement === "AMBIGU") {
      actesAmbigus.push({ source, id: acte.id });
      return [];
    }
    if (classement === "AUTRE") return [];
    return [{ id: acte.id, animalId: acte.animalId, etapeCibleId: etapeCible(acte, parId, idsCibles) }];
  });
  const vaccinationsAExtraire = selectionner("VACCINATION", vaccinations);
  const traitementsAExtraire = selectionner("TRAITEMENT", traitements);
  if (actesAmbigus.length > 0) {
    return {
      possible: false,
      raison: `${actesAmbigus.length} acte(s) sans médicament certain doivent être vérifiés avant la séparation.`,
      actesAmbigus,
    };
  }
  return { possible: true, vaccinations: vaccinationsAExtraire, traitements: traitementsAExtraire };
}
