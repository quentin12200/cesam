import type { StoredFieldSession } from "./field-weighing-session";

export type HomeActiveWeighingSession = {
  id: string;
  startedAt: string;
  count: number;
};

export type HomeWeighingView = {
  active: HomeActiveWeighingSession | null;
  pendingCount: number;
  offline: boolean;
};

export function resolveHomeWeighingView(
  serverActive: HomeActiveWeighingSession | null,
  cached: StoredFieldSession | null,
  offline: boolean,
): HomeWeighingView {
  if (serverActive) {
    const sameCache = cached?.weighingSessionId === serverActive.id;
    return {
      active: {
        ...serverActive,
        count: Math.max(serverActive.count, sameCache ? cached.entries.length : 0),
      },
      pendingCount: sameCache ? cached.pendingWeights.length : 0,
      offline,
    };
  }
  if (
    offline &&
    cached?.status === "ACTIVE" &&
    Boolean(cached.weighingSessionId || cached.entries.length || cached.pendingWeights.length)
  ) {
    return {
      active: {
        id: cached.weighingSessionId ?? "local",
        startedAt: cached.startedAt,
        count: cached.entries.length,
      },
      pendingCount: cached.pendingWeights.length,
      offline: true,
    };
  }
  return { active: null, pendingCount: 0, offline };
}
