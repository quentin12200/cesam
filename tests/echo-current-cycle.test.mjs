import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentCycleBreeding } from "../lib/current-reproduction-cycle.ts";
import { getEtatGestation } from "../lib/utils.ts";

test("une saillie antérieure au dernier vêlage ne déclenche pas une demande d'échographie", () => {
  const now = new Date();
  const lastCalving = new Date(now);
  lastCalving.setDate(lastCalving.getDate() - 5);
  const historicalBreeding = { id: "saillie-2025-08-30", date: new Date("2025-08-30T12:00:00.000Z") };

  const currentBreeding = getCurrentCycleBreeding([historicalBreeding], lastCalving);
  const phase = getEtatGestation(
    currentBreeding?.date ?? null,
    null,
    null,
    lastCalving,
    false
  );

  assert.equal(currentBreeding, null);
  assert.equal(phase, "REPOS");
});
