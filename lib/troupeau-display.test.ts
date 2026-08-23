import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MOBILE_DISPLAY_PREFERENCES,
  formatFather,
  gestationDaysForDisplay,
  parseMobileDisplayPreferences,
  serializeMobileDisplayPreferences,
  shouldDisplayNonWeaned,
} from "./troupeau-display.ts";

test("affiche le nom et le numéro du père lorsqu’ils sont connus", () => {
  assert.equal(formatFather("JOKER", "1234"), "JOKER · 1234");
  assert.equal(formatFather("JOKER", null), "JOKER");
  assert.equal(formatFather(null, "1234"), "1234");
  assert.equal(formatFather(null, null), "—");
});

test("sauvegarde et restaure les réglages mobiles", () => {
  const stored = serializeMobileDisplayPreferences({ visible: ["age", "father", "group"], gestation: "simple" });
  assert.deepEqual(parseMobileDisplayPreferences(stored), {
    visible: ["age", "father", "group"],
    gestation: "simple",
  });
});

test("restaure les valeurs par défaut si les réglages sont invalides", () => {
  assert.deepEqual(parseMobileDisplayPreferences("invalide"), DEFAULT_MOBILE_DISPLAY_PREFERENCES);
});

test("masque seulement la durée en mode gestation simple", () => {
  assert.equal(gestationDaysForDisplay("simple", 145), null);
  assert.equal(gestationDaysForDisplay("duration", 145), 145);
});

test("un animal non sevré n'est signalé que pendant sa première année", () => {
  const now = new Date("2026-08-23T12:00:00Z");
  assert.equal(shouldDisplayNonWeaned("2026-01-01", false, now), true);
  assert.equal(shouldDisplayNonWeaned("2025-01-01", false, now), false);
  assert.equal(shouldDisplayNonWeaned("2026-01-01", true, now), false);
});
