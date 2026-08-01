import type { FieldSessionEntry } from "./field-weighing";
import type { PriceGroup } from "./price-simulation";
import type { PendingFieldWeight, StoredFieldSession } from "./field-weighing-session";

type Fetcher = typeof fetch;

export type ServerWeighingSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: "ACTIVE" | "FINISHED" | "ABANDONED";
  selectionData: unknown;
  simulationData: unknown;
  fieldEntries: FieldSessionEntry[];
};

export class FieldSessionApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readResult<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new FieldSessionApiError(result.error || fallback, response.status);
  return result;
}

export async function openActiveFieldSession(fetcher: Fetcher = fetch): Promise<ServerWeighingSession> {
  const opened = await readResult<{ id: string }>(await fetcher("/api/weighing-sessions", {
    method: "POST",
  }), "La séance ne peut pas être ouverte.");
  return getFieldSession(opened.id, fetcher);
}

export async function getFieldSession(id: string, fetcher: Fetcher = fetch): Promise<ServerWeighingSession> {
  return readResult<ServerWeighingSession>(
    await fetcher(`/api/weighing-sessions/${id}`),
    "La séance ne peut pas être chargée.",
  );
}

export async function attachLegacyFieldSession(
  id: string,
  peseeIds: string[],
  fetcher: Fetcher = fetch,
): Promise<{ attached: string[]; ignored: string[] }> {
  return readResult(
    await fetcher(`/api/weighing-sessions/${id}/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peseeIds }),
    }),
    "L’ancienne séance locale ne peut pas être rattachée.",
  );
}

export async function saveFieldSessionMetadata(
  session: StoredFieldSession,
  fetcher: Fetcher = fetch,
): Promise<void> {
  if (!session.weighingSessionId) return;
  const response = await fetcher(`/api/weighing-sessions/${session.weighingSessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selectedPeseeIds: session.entries.filter((entry) => entry.selected).map((entry) => entry.id),
      summaryOpen: session.summaryOpen,
      simulationOpen: session.simulationOpen,
      priceGroups: session.priceGroups,
    }),
  });
  await readResult(response, "Les choix de la séance ne peuvent pas être synchronisés.");
}

export async function transitionFieldSession(
  id: string,
  action: "finish" | "abandon",
  fetcher: Fetcher = fetch,
): Promise<ServerWeighingSession> {
  return readResult(
    await fetcher(`/api/weighing-sessions/${id}/${action}`, { method: "POST" }),
    action === "finish" ? "La séance ne peut pas être terminée." : "La séance ne peut pas être abandonnée.",
  );
}

export function serverMetadata(session: ServerWeighingSession): {
  selectedIds: string[];
  summaryOpen: boolean;
  simulationOpen: boolean;
  priceGroups: PriceGroup[];
} {
  const selection = session.selectionData && typeof session.selectionData === "object"
    ? session.selectionData as { selectedPeseeIds?: unknown; summaryOpen?: unknown; simulationOpen?: unknown }
    : {};
  const simulation = session.simulationData && typeof session.simulationData === "object"
    ? session.simulationData as { priceGroups?: unknown }
    : {};
  const selectedIds = Array.isArray(selection.selectedPeseeIds)
    ? selection.selectedPeseeIds.filter((id): id is string => typeof id === "string")
    : session.fieldEntries.map((entry) => entry.id);
  const priceGroups = Array.isArray(simulation.priceGroups)
    ? simulation.priceGroups as PriceGroup[]
    : [];
  return {
    selectedIds,
    summaryOpen: selection.summaryOpen === true,
    simulationOpen: selection.simulationOpen === true,
    priceGroups,
  };
}

export function sessionFromServer(
  server: ServerWeighingSession,
  cached?: StoredFieldSession,
): StoredFieldSession {
  const metadata = serverMetadata(server);
  const selected = new Set(metadata.selectedIds);
  const sameSession = cached?.weighingSessionId === server.id;
  const canonicalIds = new Set(server.fieldEntries.map((entry) => entry.id));
  const priceGroups = (sameSession ? cached.priceGroups : metadata.priceGroups)
    .map((group) => ({
      ...group,
      peseeIds: group.peseeIds.filter((id) => canonicalIds.has(id)),
    }))
    .filter((group) => group.peseeIds.length > 0);
  return {
    weighingSessionId: server.id,
    startedAt: server.startedAt,
    status: server.status,
    entries: server.fieldEntries.map((entry) => ({
      ...entry,
      selected: sameSession
        ? cached.entries.find((local) => local.id === entry.id)?.selected ?? selected.has(entry.id)
        : selected.has(entry.id),
    })),
    pendingWeights: sameSession ? cached.pendingWeights : [],
    summaryOpen: server.status === "ACTIVE"
      ? sameSession ? cached.summaryOpen : metadata.summaryOpen
      : true,
    simulationOpen: sameSession ? cached.simulationOpen : metadata.simulationOpen,
    priceGroups,
  };
}

export function pendingWeightInput(pending: PendingFieldWeight, session: StoredFieldSession) {
  if (!session.weighingSessionId) throw new Error("Séance serveur absente.");
  return {
    nutrav: pending.nutrav,
    poids: pending.poids,
    date: pending.date,
    sessionStartedAt: session.startedAt,
    weighingSessionId: session.weighingSessionId,
  };
}
