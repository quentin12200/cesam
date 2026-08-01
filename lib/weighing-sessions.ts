import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.ts";

export const WEIGHING_SESSION_STATUSES = ["ACTIVE", "FINISHED", "ABANDONED"] as const;
export type WeighingSessionStatus = (typeof WEIGHING_SESSION_STATUSES)[number];

type WeighingSessionDb = Pick<PrismaClient, "weighingSession">;
type WeighingSessionWeightDb = Pick<PrismaClient, "weighingSession" | "pesee">;

export type WeighingSessionMetadata = {
  selectedPeseeIds: string[];
  summaryOpen: boolean;
  simulationOpen: boolean;
  priceGroups: Array<{
    id: string;
    sexe: "M" | "F";
    peseeIds: string[];
    mode: "PER_KG" | "PER_HEAD";
    tarif: number;
  }>;
};

const sessionDetails = {
  pesees: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      animal: {
        select: {
          id: true,
          nutrav: true,
          sexbov: true,
          danais: true,
          mere: { select: { nutrav: true } },
        },
      },
    },
  },
} satisfies Prisma.WeighingSessionInclude;

export class WeighingSessionError extends Error {
  readonly code: "NOT_FOUND" | "NOT_ACTIVE" | "INVALID_STATUS" | "DUPLICATE_ANIMAL";

  constructor(
    code: "NOT_FOUND" | "NOT_ACTIVE" | "INVALID_STATUS" | "DUPLICATE_ANIMAL",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export function isWeighingSessionStatus(value: string | null): value is WeighingSessionStatus {
  return WEIGHING_SESSION_STATUSES.includes(value as WeighingSessionStatus);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  ) || String(error).includes("UNIQUE constraint failed");
}

export function isWeighingSessionWeightDuplicateError(error: unknown): boolean {
  return isUniqueConstraintError(error);
}

export async function assertActiveWeighingSessionForAnimal(
  sessionId: string,
  animalId: string,
  db: WeighingSessionWeightDb = prisma,
) {
  const session = await db.weighingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, startedAt: true },
  });
  if (!session) throw new WeighingSessionError("NOT_FOUND", "Séance de pesée introuvable.");
  if (session.status !== "ACTIVE") {
    throw new WeighingSessionError("NOT_ACTIVE", "Cette séance de pesée est terminée.");
  }
  const duplicate = await db.pesee.findFirst({
    where: { weighingSessionId: sessionId, animalId },
    select: { id: true },
  });
  if (duplicate) {
    throw new WeighingSessionError(
      "DUPLICATE_ANIMAL",
      "Cet animal possède déjà une pesée dans cette séance.",
    );
  }
  return session;
}

export async function getOrCreateActiveWeighingSession(
  db: WeighingSessionDb = prisma,
) {
  const active = await db.weighingSession.findFirst({
    where: { status: "ACTIVE" },
    include: sessionDetails,
  });
  if (active) return active;

  try {
    return await db.weighingSession.create({
      data: { status: "ACTIVE" },
      include: sessionDetails,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrent = await db.weighingSession.findFirst({
      where: { status: "ACTIVE" },
      include: sessionDetails,
    });
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function getWeighingSession(
  id: string,
  db: WeighingSessionDb = prisma,
) {
  const session = await db.weighingSession.findUnique({
    where: { id },
    include: sessionDetails,
  });
  if (!session) throw new WeighingSessionError("NOT_FOUND", "Séance de pesée introuvable.");
  return session;
}

export async function updateWeighingSessionMetadata(
  id: string,
  metadata: WeighingSessionMetadata,
  db: WeighingSessionDb = prisma,
) {
  const existing = await db.weighingSession.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new WeighingSessionError("NOT_FOUND", "Séance de pesée introuvable.");
  await db.weighingSession.update({
    where: { id },
    data: {
      selectionData: {
        selectedPeseeIds: metadata.selectedPeseeIds,
        summaryOpen: metadata.summaryOpen,
        simulationOpen: metadata.simulationOpen,
      },
      simulationData: { priceGroups: metadata.priceGroups },
    },
  });
  return getWeighingSession(id, db);
}

export async function attachExistingWeightsToSession(
  sessionId: string,
  peseeIds: string[],
  db: WeighingSessionWeightDb = prisma,
) {
  const session = await db.weighingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  });
  if (!session) throw new WeighingSessionError("NOT_FOUND", "Séance de pesée introuvable.");
  if (session.status !== "ACTIVE") {
    throw new WeighingSessionError("NOT_ACTIVE", "Cette séance de pesée est terminée.");
  }

  const uniqueIds = [...new Set(peseeIds.filter(Boolean))];
  const weights = await db.pesee.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, animalId: true, weighingSessionId: true },
  });
  const attached: string[] = [];
  const ignored: string[] = uniqueIds.filter((id) => !weights.some((weight) => weight.id === id));

  for (const weight of weights) {
    if (weight.weighingSessionId === sessionId) {
      attached.push(weight.id);
      continue;
    }
    if (weight.weighingSessionId !== null) {
      ignored.push(weight.id);
      continue;
    }
    const duplicateAnimal = await db.pesee.findFirst({
      where: { weighingSessionId: sessionId, animalId: weight.animalId },
      select: { id: true },
    });
    if (duplicateAnimal) {
      ignored.push(weight.id);
      continue;
    }
    try {
      const updated = await db.pesee.updateMany({
        where: { id: weight.id, weighingSessionId: null },
        data: { weighingSessionId: sessionId },
      });
      if (updated.count === 1) attached.push(weight.id);
      else ignored.push(weight.id);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await db.pesee.findUnique({
        where: { id: weight.id },
        select: { weighingSessionId: true },
      });
      if (concurrent?.weighingSessionId === sessionId) attached.push(weight.id);
      else ignored.push(weight.id);
    }
  }

  return { attached, ignored, session: await getWeighingSession(sessionId, db) };
}

export async function transitionWeighingSession(
  id: string,
  status: Exclude<WeighingSessionStatus, "ACTIVE">,
  endedAt: Date = new Date(),
  db: WeighingSessionDb = prisma,
) {
  const updated = await db.weighingSession.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status, endedAt },
  });
  if (updated.count === 0) {
    const existing = await db.weighingSession.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new WeighingSessionError("NOT_FOUND", "Séance de pesée introuvable.");
    throw new WeighingSessionError("NOT_ACTIVE", "Cette séance de pesée n’est plus active.");
  }
  return getWeighingSession(id, db);
}

export async function listWeighingSessions(
  input: { page: number; limit: number; status?: WeighingSessionStatus },
  db: WeighingSessionDb = prisma,
) {
  const where = input.status ? { status: input.status } : {};
  const [items, total] = await Promise.all([
    db.weighingSession.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      include: { _count: { select: { pesees: true } } },
    }),
    db.weighingSession.count({ where }),
  ]);
  return { items, total, page: input.page, limit: input.limit };
}
