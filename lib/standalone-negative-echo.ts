export interface ActiveEchoRequestSnapshot {
  id: string;
  origine: string;
  etat: string;
  clotureeAt: Date | null;
  requestKey: string | null;
  observation: string | null;
}

export interface StandaloneNegativeEchoAnimalSnapshot {
  id: string;
  aEchographier: boolean;
  reproductionEtatManuel: string | null;
  reproductionEtatPrecedent: string | null;
  reproductionEtatModifieAt: Date | null;
  demandesEchographie: ActiveEchoRequestSnapshot[];
}

export function mergeEchoObservation(previous: string | null, current?: string): string | null {
  const next = current?.trim() || null;
  if (!next) return previous;
  if (!previous?.trim()) return next;
  if (previous.trim() === next) return previous.trim();
  return `${previous.trim()}\n${next}`;
}

export function buildStandaloneNegativeEchoPlan(
  animal: StandaloneNegativeEchoAnimalSnapshot,
  echoDate: Date,
  observation?: string,
) {
  const requestUpdates = animal.demandesEchographie.map((request) => ({
    id: request.id,
    data: {
      etat: "REALISEE",
      clotureeAt: echoDate,
      observation: mergeEchoObservation(request.observation, observation),
      ...(request.origine === "MANUELLE" ? { requestKey: null } : {}),
    },
  }));

  return {
    animalUpdate: {
      aEchographier: false,
      reproductionEtatManuel: "ROUGE",
      reproductionEtatPrecedent: animal.reproductionEtatManuel,
      reproductionEtatModifieAt: echoDate,
    },
    requestUpdates,
    requestCreate: requestUpdates.length === 0 ? {
      animalId: animal.id,
      saillieId: null,
      origine: "MANUELLE",
      etat: "REALISEE",
      motif: "DIAGNOSTIC_GESTATION",
      planifieeAt: echoDate,
      clotureeAt: echoDate,
      observation: observation?.trim() || null,
      requestKey: null,
    } : null,
  };
}
