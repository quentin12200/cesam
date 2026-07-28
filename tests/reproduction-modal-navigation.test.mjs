import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const externalTriggers = [
  "app/components/AccueilQuickActions.tsx",
  "app/components/ActiveHeatAction.tsx",
  "app/components/VoiceButton.tsx",
  "app/troupeau/[nutrav]/QuickActionsBar.tsx",
];

test("les actions externes n’utilisent plus Reproduction comme route intermédiaire", async () => {
  for (const path of externalTriggers) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /router\.push\([^)]*\/reproduction/);
    assert.doesNotMatch(source, /hrefWithOrigin\([^)]*\/reproduction/);
    assert.match(source, /openReproductionModal/);
  }
});

test("la modale globale rafraîchit la page courante sans navigation", async () => {
  const source = await readFile("app/components/ReproductionModalProvider.tsx", "utf8");
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /showOriginConfirmation\(message\)/);
  assert.doesNotMatch(source, /router\.(push|replace)\(/);
  assert.doesNotMatch(source, /location\.(assign|replace)\(/);
});

test("la route Reproduction autonome continue de traiter les URL directes", async () => {
  const source = await readFile("app/reproduction/page.tsx", "utf8");
  assert.match(source, /searchParams\.get\("action"\)/);
  assert.match(source, /setShowChaleurForm\(true\)/);
  assert.match(source, /setShowSaillieForm\(true\)/);
});
