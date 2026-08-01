import assert from "node:assert/strict";
import test from "node:test";
import {
  assertActiveWeighingSessionForAnimal,
  getOrCreateActiveWeighingSession,
  isWeighingSessionStatus,
  listWeighingSessions,
  transitionWeighingSession,
  WeighingSessionError,
} from "./weighing-sessions.ts";

const activeSession = {
  id: "s1",
  status: "ACTIVE",
  startedAt: new Date("2026-08-01T08:00:00.000Z"),
  endedAt: null,
  selectionData: null,
  simulationData: null,
  createdAt: new Date("2026-08-01T08:00:00.000Z"),
  updatedAt: new Date("2026-08-01T08:00:00.000Z"),
  pesees: [],
};

test("crée une première séance active", async () => {
  let createCalls = 0;
  const db = {
    weighingSession: {
      findFirst: async () => null,
      create: async () => { createCalls += 1; return activeSession; },
    },
  };

  assert.equal((await getOrCreateActiveWeighingSession(db as never)).id, "s1");
  assert.equal(createCalls, 1);
});

test("retourne la séance active existante sans doublon", async () => {
  let createCalls = 0;
  const db = {
    weighingSession: {
      findFirst: async () => activeSession,
      create: async () => { createCalls += 1; return activeSession; },
    },
  };

  assert.equal((await getOrCreateActiveWeighingSession(db as never)).id, "s1");
  assert.equal(createCalls, 0);
});

test("une collision concurrente retourne la séance créée par l'autre requête", async () => {
  let reads = 0;
  const db = {
    weighingSession: {
      findFirst: async () => {
        reads += 1;
        return reads === 1 ? null : activeSession;
      },
      create: async () => { throw new Error("UNIQUE constraint failed"); },
    },
  };

  assert.equal((await getOrCreateActiveWeighingSession(db as never)).id, "s1");
  assert.equal(reads, 2);
});

test("refuse une pesée dans une séance terminée", async () => {
  const db = {
    weighingSession: {
      findUnique: async () => ({ id: "s1", status: "FINISHED", startedAt: new Date() }),
    },
    pesee: { findFirst: async () => null },
  };

  await assert.rejects(
    assertActiveWeighingSessionForAnimal("s1", "a1", db as never),
    (error) => error instanceof WeighingSessionError && error.code === "NOT_ACTIVE",
  );
});

test("refuse un doublon animal dans la même séance", async () => {
  const db = {
    weighingSession: {
      findUnique: async () => ({ id: "s1", status: "ACTIVE", startedAt: new Date() }),
    },
    pesee: { findFirst: async () => ({ id: "p1" }) },
  };

  await assert.rejects(
    assertActiveWeighingSessionForAnimal("s1", "a1", db as never),
    (error) => error instanceof WeighingSessionError && error.code === "DUPLICATE_ANIMAL",
  );
});

test("valide uniquement les trois statuts canoniques", () => {
  assert.equal(isWeighingSessionStatus("ACTIVE"), true);
  assert.equal(isWeighingSessionStatus("FINISHED"), true);
  assert.equal(isWeighingSessionStatus("ABANDONED"), true);
  assert.equal(isWeighingSessionStatus("REOPENED"), false);
});

test("termine une séance active avec endedAt sans supprimer de pesée", async () => {
  let transitionData: unknown;
  const finished = {
    ...activeSession,
    status: "FINISHED",
    endedAt: new Date("2026-08-01T10:00:00.000Z"),
    pesees: [{ id: "p1" }],
  };
  const db = {
    weighingSession: {
      updateMany: async ({ data }: { data: unknown }) => { transitionData = data; return { count: 1 }; },
      findUnique: async () => finished,
    },
  };

  const result = await transitionWeighingSession(
    "s1",
    "FINISHED",
    finished.endedAt,
    db as never,
  );
  assert.deepEqual(transitionData, { status: "FINISHED", endedAt: finished.endedAt });
  assert.equal(result.pesees.length, 1);
});

test("liste les séances par date décroissante avec pagination et statut", async () => {
  let findArguments: unknown;
  const db = {
    weighingSession: {
      findMany: async (args: unknown) => { findArguments = args; return [activeSession]; },
      count: async () => 1,
    },
  };

  const result = await listWeighingSessions(
    { page: 2, limit: 10, status: "FINISHED" },
    db as never,
  );
  assert.deepEqual(findArguments, {
    where: { status: "FINISHED" },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    skip: 10,
    take: 10,
    include: { _count: { select: { pesees: true } } },
  });
  assert.deepEqual({ total: result.total, page: result.page, limit: result.limit }, {
    total: 1,
    page: 2,
    limit: 10,
  });
});
