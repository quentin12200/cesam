import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentReproductionSummary } from "./current-reproduction-summary.ts";

const NOW = new Date("2026-08-28T12:00:00.000Z");

test("résume le dernier vêlage et calcule le nombre de jours écoulés", () => {
  const summary = getCurrentReproductionSummary([], new Date("2026-04-08T12:00:00.000Z"), NOW);

  assert.equal(summary.lastCalving?.toISOString(), "2026-04-08T12:00:00.000Z");
  assert.equal(summary.daysSinceLastCalving, 142);
  assert.equal(summary.lastEcho, null);
});

test("indique qu'aucune échographie n'existe depuis le dernier vêlage", () => {
  const summary = getCurrentReproductionSummary(
    [{ id: "attempt-1", date: new Date("2026-07-12T12:00:00.000Z"), type: "IA", gestation: null }],
    new Date("2026-05-24T12:00:00.000Z"),
    NOW,
  );

  assert.equal(summary.lastEcho, null);
  assert.equal(summary.lastAttempt?.type, "IA");
  assert.equal(summary.lastAttempt?.daysSince, 47);
});

test("retient la dernière échographie négative du cycle avec sa date", () => {
  const summary = getCurrentReproductionSummary(
    [{
      id: "attempt-1",
      date: new Date("2026-05-20T12:00:00.000Z"),
      type: "NATURELLE",
      gestation: { dateEcho: new Date("2026-06-12T12:00:00.000Z"), resultatEcho: "VIDE" },
    }],
    new Date("2026-04-08T12:00:00.000Z"),
    NOW,
  );

  assert.equal(summary.lastEcho?.result, "VIDE");
  assert.equal(summary.lastEcho?.date.toISOString(), "2026-06-12T12:00:00.000Z");
});

test("ignore une échographie antérieure au dernier vêlage", () => {
  const summary = getCurrentReproductionSummary(
    [{
      id: "old-attempt",
      date: new Date("2026-02-01T12:00:00.000Z"),
      type: "NATURELLE",
      gestation: { dateEcho: new Date("2026-03-01T12:00:00.000Z"), resultatEcho: "PLEINE" },
    }],
    new Date("2026-04-08T12:00:00.000Z"),
    NOW,
  );

  assert.equal(summary.lastEcho, null);
  assert.equal(summary.lastAttempt, null);
});

test("distingue la dernière échographie de la nouvelle tentative", () => {
  const summary = getCurrentReproductionSummary(
    [
      { id: "new-attempt", date: new Date("2026-07-21T12:00:00.000Z"), type: "IA", gestation: null },
      {
        id: "echoed-attempt",
        date: new Date("2026-05-20T12:00:00.000Z"),
        type: "NATURELLE",
        gestation: { dateEcho: new Date("2026-06-12T12:00:00.000Z"), resultatEcho: "VIDE" },
      },
    ],
    new Date("2026-04-08T12:00:00.000Z"),
    NOW,
  );

  assert.equal(summary.lastEcho?.date.toISOString(), "2026-06-12T12:00:00.000Z");
  assert.equal(summary.lastAttempt?.id, "new-attempt");
  assert.equal(summary.lastAttempt?.daysSince, 38);
});
