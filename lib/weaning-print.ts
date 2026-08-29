import type { WeaningWindow } from "./weaning-dry-off.ts";

export interface WeaningPrintCandidate {
  id: string;
  nutrav: string;
  birthDate: Date;
  window: WeaningWindow;
  needsWeaning: boolean;
  sex: string | null;
  motherNutrav: string | null;
  motherStatus: string;
  motherHasActiveEchoRequest: boolean;
}

export interface WeaningPrintRow extends WeaningPrintCandidate {
  sexLabel: "F" | "M" | "—";
  simultaneousTask: string;
}

export function getWeaningPrintMotherInfo(
  activeEchoRequest: boolean,
  reproductionStatus: string | null,
): { motherStatus: string; simultaneousTask: string } {
  if (activeEchoRequest) {
    return {
      motherStatus: "À écho",
      simultaneousTask: "☐ Échographier mère",
    };
  }
  return {
    motherStatus: reproductionStatus?.trim() || "Inconnu",
    simultaneousTask: "—",
  };
}

export function buildWeaningPrintGroups(
  candidates: WeaningPrintCandidate[],
): { ready: WeaningPrintRow[]; upcoming: WeaningPrintRow[] } {
  const rows = candidates
    .filter((candidate) => candidate.needsWeaning)
    .map((candidate) => {
      const motherInfo = getWeaningPrintMotherInfo(
        candidate.motherHasActiveEchoRequest,
        candidate.motherStatus,
      );
      return {
        ...candidate,
        sexLabel: candidate.sex === "F" || candidate.sex === "M" ? candidate.sex : "—",
        motherStatus: motherInfo.motherStatus,
        simultaneousTask: motherInfo.simultaneousTask,
      } satisfies WeaningPrintRow;
    })
    .sort((left, right) => left.birthDate.getTime() - right.birthDate.getTime());

  return {
    ready: rows.filter((row) => row.window === "NOW"),
    upcoming: rows.filter((row) => row.window === "SOON"),
  };
}
