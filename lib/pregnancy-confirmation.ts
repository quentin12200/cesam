export interface ConfirmedPregnancy {
  id: string;
  etat: string;
}
/** Confirming a new pregnancy supersedes prior confirmed records without deleting them. */
export function supersededPregnancyIds(
  pregnancies: ConfirmedPregnancy[],
  confirmedId: string,
): string[] {
  return pregnancies.filter(p => p.etat === "VERT" && p.id !== confirmedId).map(p => p.id);
}
