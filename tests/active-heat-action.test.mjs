import test from "node:test";
import assert from "node:assert/strict";
import { getActiveHeat } from "../lib/active-heat-action.ts";

const now = new Date("2026-07-27T12:00:00.000Z");
const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);

test("affiche la chaleur la plus récente pendant 48 heures", () => {
  const recent = { date: hoursAgo(2) };
  const older = { date: hoursAgo(20) };
  assert.equal(getActiveHeat([older, recent], [], now), recent);
});

test("masque la chaleur à partir de 48 heures", () => {
  assert.equal(getActiveHeat([{ date: hoursAgo(48) }], [], now), null);
});

test("masque l’action après une saillie postérieure", () => {
  const heat = { date: hoursAgo(4) };
  const breeding = { date: hoursAgo(2) };
  assert.equal(getActiveHeat([heat], [breeding], now), null);
});

test("masque l’action après une saillie enregistrée après la chaleur même si sa date est antérieure", () => {
  const heat = { date: hoursAgo(4) };
  const breeding = { date: hoursAgo(8), createdAt: hoursAgo(2) };
  assert.equal(getActiveHeat([heat], [breeding], now), null);
});

test("une saillie antérieure ne masque pas une nouvelle chaleur", () => {
  const heat = { date: hoursAgo(2) };
  const breeding = { date: hoursAgo(8), createdAt: hoursAgo(8) };
  assert.equal(getActiveHeat([heat], [breeding], now), heat);
});

test("ignore une chaleur datée dans le futur", () => {
  const future = { date: new Date(now.getTime() + 60 * 60 * 1000) };
  assert.equal(getActiveHeat([future], [], now), null);
});
