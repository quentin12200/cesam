import { classifyWeaningWindow } from "./weaning-dry-off.ts";
import { shouldDisplayNonWeaned } from "./troupeau-display.ts";

export interface WeaningPrintCandidate {
  id: string;
  nutrav: string;
  birthDate: Date;
  statut: string;
  sevreFait: boolean;
  motherNutrav: string | null;
  motherStatus: string;
  motherHasActiveEchoRequest: boolean;
}

export interface WeaningPrintRow extends WeaningPrintCandidate {
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
  now = new Date(),
): { ready: WeaningPrintRow[]; upcoming: WeaningPrintRow[] } {
  const rows = candidates
    .filter((candidate) =>
      candidate.statut === "ACTIF"
      && !candidate.sevreFait
      && shouldDisplayNonWeaned(candidate.birthDate, candidate.sevreFait, now)
    )
    .flatMap((candidate) => {
      const window = classifyWeaningWindow(candidate.birthDate, 6, now).window;
      if (!window) return [];
      const motherInfo = getWeaningPrintMotherInfo(
        candidate.motherHasActiveEchoRequest,
        candidate.motherStatus,
      );
      return [{
        ...candidate,
        motherStatus: motherInfo.motherStatus,
        simultaneousTask: motherInfo.simultaneousTask,
        window,
      }];
    })
    .sort((left, right) => left.birthDate.getTime() - right.birthDate.getTime());

  return {
    ready: rows.filter((row) => row.window === "NOW"),
    upcoming: rows.filter((row) => row.window === "SOON"),
  };
}
