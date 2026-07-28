import test from "node:test";
import assert from "node:assert/strict";
import { getHeatReturnReminder } from "../lib/heat-return-monitoring.ts";

const now = new Date("2026-07-28T12:00:00.000Z");
const daysAgo = (days, hours = 0) =>
  new Date(now.getTime() - (days * 24 + hours) * 60 * 60 * 1000);
const rule = { enabled: true, startDay: 18, endDay: 24 };

test("respecte les bornes inclusives J18 à J24", () => {
  assert.equal(getHeatReturnReminder([{ date: daysAgo(17) }], [], null, rule, now), null);
  assert.equal(getHeatReturnReminder([{ date: daysAgo(18) }], [], null, rule, now)?.day, 18);
  assert.equal(getHeatReturnReminder([{ date: daysAgo(24, 23) }], [], null, rule, now)?.day, 24);
  assert.equal(getHeatReturnReminder([{ date: daysAgo(25) }], [], null, rule, now), null);
});

test("conserve le rappel avec une saillie ou une IA et adapte le message", () => {
  const heat = { date: daysAgo(20) };
  const before = getHeatReturnReminder([heat], [{ date: daysAgo(21) }], null, rule, now);
  const after = getHeatReturnReminder([heat], [{ date: daysAgo(19) }], null, rule, now);
  assert.equal(before?.hasBreedingAfterHeat, false);
  assert.equal(after?.hasBreedingAfterHeat, true);
});

test("une nouvelle chaleur devient la référence et remet le compteur à zéro", () => {
  const older = { id: "older", date: daysAgo(20) };
  const latest = { id: "latest", date: daysAgo(2) };
  assert.equal(getHeatReturnReminder([older, latest], [], null, rule, now), null);
  assert.equal(getHeatReturnReminder([older], [], null, rule, now)?.heat.id, "older");
});

test("une échographie positive annule le rappel mais pas une négative", () => {
  const heat = { date: daysAgo(20) };
  assert.equal(
    getHeatReturnReminder([heat], [{ date: daysAgo(19), gestation: { etat: "VERT" } }], null, rule, now),
    null
  );
  assert.equal(
    getHeatReturnReminder([heat], [{ date: daysAgo(19), gestation: { etat: "ROUGE" } }], null, rule, now)?.day,
    20
  );
});

test("ignore les chaleurs antérieures au dernier vêlage", () => {
  assert.equal(
    getHeatReturnReminder([{ date: daysAgo(20) }], [], daysAgo(10), rule, now),
    null
  );
});

test("respecte la désactivation et le statut gestante confirmé", () => {
  const heat = { date: daysAgo(20) };
  assert.equal(getHeatReturnReminder([heat], [], null, { ...rule, enabled: false }, now), null);
  assert.equal(getHeatReturnReminder([heat], [], null, rule, now, true), null);
});
