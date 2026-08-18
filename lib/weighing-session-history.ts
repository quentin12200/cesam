import { prisma } from "./prisma.ts";
import { calculateGmqKgPerDay, type FieldSessionEntry } from "./field-weighing.ts";
import { getWeighingSession, type WeighingSessionStatus } from "./weighing-sessions.ts";
import { parsePriceGroups, type PriceGroup } from "./price-simulation.ts";

export type WeighingSessionIndicators = {
  count: number;
  males: number;
  females: number;
  averageWeight: number | null;
  averageGmq: number | null;
};

export type WeighingSessionHistoryItem = WeighingSessionIndicators & {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: WeighingSessionStatus;
  hasSimulation: boolean;
};

export type WeighingSessionHistoryDetail = WeighingSessionHistoryItem & {
  entries: FieldSessionEntry[];
  priceGroups: PriceGroup[];
  selectionData: unknown;
  simulationData: unknown;
};

export const WEIGHING_SESSION_FILTERS: Array<{ label: string; status?: WeighingSessionStatus }> = [
  { label: "Toutes" },
  { label: "En cours", status: "ACTIVE" },
  { label: "Terminées", status: "FINISHED" },
  { label: "Abandonnées", status: "ABANDONED" },
];

export function sortWeighingSessionsNewestFirst<T extends { startedAt: string; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime() || right.id.localeCompare(left.id),
  );
}

export function calculateWeighingSessionIndicators(
  entries: Array<Pick<FieldSessionEntry, "sexe" | "poids" | "gmq">>,
): WeighingSessionIndicators {
  const availableGmqs = entries.flatMap((entry) => entry.gmq === null ? [] : [entry.gmq]);
  return {
    count: entries.length,
    males: entries.filter((entry) => entry.sexe === "M").length,
    females: entries.filter((entry) => entry.sexe === "F").length,
    averageWeight: entries.length === 0
      ? null
      : Math.round(entries.reduce((total, entry) => total + entry.poids, 0) / entries.length),
    averageGmq: availableGmqs.length === 0
      ? null
      : Math.round((availableGmqs.reduce((total, gmq) => total + gmq, 0) / availableGmqs.length) * 10) / 10,
  };
}

function selectedIds(selectionData: unknown, fallbackIds: string[]): Set<string> {
  if (!selectionData || typeof selectionData !== "object") return new Set(fallbackIds);
  const value = (selectionData as { selectedPeseeIds?: unknown }).selectedPeseeIds;
  if (!Array.isArray(value)) return new Set(fallbackIds);
  return new Set(value.filter((id): id is string => typeof id === "string"));
}

async function fieldEntriesForSession(
  session: Awaited<ReturnType<typeof getWeighingSession>>,
): Promise<FieldSessionEntry[]> {
  const selected = selectedIds(session.selectionData, session.pesees.map((pesee) => pesee.id));
  return Promise.all(session.pesees.map(async (pesee) => {
    const previous = await prisma.pesee.findFirst({
      where: {
        animalId: pesee.animalId,
        createdAt: { lt: session.startedAt },
        id: { not: pesee.id },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { poids: true, date: true },
    });
    return {
      id: pesee.id,
      animalId: pesee.animalId,
      nutrav: pesee.animal.nutrav,
      mereNutrav: pesee.animal.mere?.nutrav ?? null,
      birthDate: pesee.animal.danais.toISOString(),
      sexe: pesee.animal.sexbov === "M" ? "M" : "F",
      poids: pesee.poids,
      gmq: calculateGmqKgPerDay(pesee.poids, pesee.date, previous),
      selected: selected.has(pesee.id),
    };
  }));
}

export function parseHistoryPriceGroups(simulationData: unknown): PriceGroup[] {
  if (!simulationData || typeof simulationData !== "object") return [];
  return parsePriceGroups(JSON.stringify((simulationData as { priceGroups?: unknown }).priceGroups ?? []));
}

export async function getWeighingSessionHistoryDetail(
  id: string,
): Promise<WeighingSessionHistoryDetail> {
  const session = await getWeighingSession(id);
  const entries = await fieldEntriesForSession(session);
  const priceGroups = parseHistoryPriceGroups(session.simulationData);
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    status: session.status,
    hasSimulation: priceGroups.length > 0,
    entries,
    priceGroups,
    selectionData: session.selectionData,
    simulationData: session.simulationData,
    ...calculateWeighingSessionIndicators(entries),
  };
}

export async function getWeighingSessionHistory(input: {
  page: number;
  limit: number;
  status?: WeighingSessionStatus;
}) {
  const where = input.status ? { status: input.status } : {};
  const [sessions, total] = await Promise.all([
    prisma.weighingSession.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: { id: true },
    }),
    prisma.weighingSession.count({ where }),
  ]);
  const items = sortWeighingSessionsNewestFirst(
    await Promise.all(sessions.map(({ id }) => getWeighingSessionHistoryDetail(id))),
  );
  return { items, total, page: input.page, limit: input.limit };
}

export function statusLabel(status: WeighingSessionStatus): string {
  if (status === "ACTIVE") return "En cours";
  if (status === "FINISHED") return "Terminée";
  return "Abandonnée";
}

export function isHistorySessionReadOnly(status: WeighingSessionStatus): boolean {
  return status !== "ACTIVE";
}
