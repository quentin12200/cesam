import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.ts";

export const WEIGHING_SESSION_STATUSES = ["ACTIVE", "FINISHED", "ABANDONED"] as const;
export type WeighingSessionStatus = (typeof WEIGHING_SESSION_STATUSES)[number];

type WeighingSessionDb = Pick<PrismaClient, "weighingSession">;
type WeighingSessionWeightDb = Pick<PrismaClient, "weighingSession" | "pesee">;

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
