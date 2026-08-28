import { prisma } from "@/lib/prisma";

export interface ManualEchoRequestInput {
  nutrav: string;
  motif?: string;
  datePlanification?: string;
  observation?: string;
  saillieId?: string | null;
}

export type ManualEchoRequestResult =
  | { status: "ADDED"; request: { id: string } }
  | { status: "ALREADY_ACTIVE"; request: { id: string } }
  | { status: "NOT_FOUND" }
  | { status: "NOT_FEMALE" }
  | { status: "INVALID_BREEDING" };

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "P2002",
  );
}

export async function createManualEchoRequest(
  input: ManualEchoRequestInput,
): Promise<ManualEchoRequestResult> {
  const animal = await prisma.animal.findUnique({
    where: { nutrav: input.nutrav },
    select: {
      id: true,
      sexbov: true,
      demandesEchographie: {
        where: { etat: "A_FAIRE" },
        take: 1,
        select: { id: true },
      },
      saillies: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { id: true, date: true },
      },
      velagesVache: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { date: true },
      },
    },
  });

  if (!animal) return { status: "NOT_FOUND" };
  if (animal.sexbov !== "F") return { status: "NOT_FEMALE" };
  if (animal.demandesEchographie[0]) {
    return { status: "ALREADY_ACTIVE", request: animal.demandesEchographie[0] };
  }

  const lastCalving = animal.velagesVache[0]?.date ?? null;
  const currentCycleBreedings = animal.saillies.filter(
    (breeding) => !lastCalving || breeding.date.getTime() > lastCalving.getTime(),
  );
  const requestedBreedingId = input.saillieId ?? currentCycleBreedings[0]?.id ?? null;
  if (
    requestedBreedingId
    && !currentCycleBreedings.some((breeding) => breeding.id === requestedBreedingId)
  ) {
    return { status: "INVALID_BREEDING" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.demandeEchographie.findFirst({
        where: { animalId: animal.id, etat: "A_FAIRE" },
        select: { id: true },
      });
      if (existing) return { status: "ALREADY_ACTIVE" as const, request: existing };

      const request = await tx.demandeEchographie.create({
        data: {
          animalId: animal.id,
          saillieId: requestedBreedingId,
          origine: "MANUELLE",
          etat: "A_FAIRE",
          motif: input.motif?.trim() || null,
          planifieeAt: input.datePlanification ? new Date(input.datePlanification) : new Date(),
          observation: input.observation?.trim() || null,
          requestKey: `MANUAL_ACTIVE:${animal.id}`,
        },
        select: { id: true },
      });
      await tx.animal.update({
        where: { id: animal.id },
        data: { aEchographier: true },
      });
      return { status: "ADDED" as const, request };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.demandeEchographie.findFirst({
      where: { animalId: animal.id, etat: "A_FAIRE" },
      select: { id: true },
    });
    if (existing) return { status: "ALREADY_ACTIVE", request: existing };
    throw error;
  }
}
