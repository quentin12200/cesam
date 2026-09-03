export interface EchoRequestState {
  id?: string;
  animalId?: string;
  saillieId?: string | null;
  origine?: string | null;
  etat: string;
}

export interface EchoActionListState {
  aEchographier: boolean;
  reproductionEtatManuel?: string | null;
  demandesEchographie: readonly Pick<EchoRequestState, "etat">[];
}

export interface ManualEchoRequestDataInput {
  animalId: string;
  saillieId: string | null;
  motif?: string;
  datePlanification?: string;
  observation?: string;
  now?: Date;
}

export function buildManualEchoRequestData(input: ManualEchoRequestDataInput) {
  return {
    animalId: input.animalId,
    saillieId: input.saillieId,
    origine: "MANUELLE",
    etat: "A_FAIRE",
    motif: input.motif?.trim() || null,
    planifieeAt: input.datePlanification ? new Date(input.datePlanification) : (input.now ?? new Date()),
    observation: input.observation?.trim() || null,
    requestKey: `MANUAL_ACTIVE:${input.animalId}`,
  };
}

export function isActiveEchoRequest(request: Pick<EchoRequestState, "etat">): boolean {
  return request.etat === "A_FAIRE";
}

export function findActiveManualEchoRequest<T extends EchoRequestState>(requests: readonly T[]): T | undefined {
  return requests.find((request) => request.origine === "MANUELLE" && isActiveEchoRequest(request));
}

export function belongsToEchoActionList(state: EchoActionListState): boolean {
  return state.aEchographier
    || state.reproductionEtatManuel === "JAUNE"
    || state.demandesEchographie.some(isActiveEchoRequest);
}

export function getObsoleteAutomaticEchoRequestIds(
  requests: readonly Required<Pick<EchoRequestState, "id" | "animalId" | "origine"> & { saillieId: string | null }>[],
  currentAttemptByAnimal: ReadonlyMap<string, string>,
): string[] {
  return requests
    .filter((request) => (
      request.origine === "AUTOMATIQUE"
      && currentAttemptByAnimal.get(request.animalId) !== request.saillieId
    ))
    .map((request) => request.id);
}
