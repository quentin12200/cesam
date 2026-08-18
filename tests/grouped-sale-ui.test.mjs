import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [session, quickWeighing, page, form, modal, route] = await Promise.all([
  readFile(new URL("../app/troupeau/pesee/sessions/[id]/SessionDetailClient.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/pesee/FieldWeighingSession.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/troupeau/pesee/sessions/[id]/vente/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/finances/SortieForm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/finances/SortieEditorModal.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/sorties/route.ts", import.meta.url), "utf8"),
]);

test("la séance ouvre directement la vente avec ses animaux présélectionnés", () => {
  assert.match(session, /Vendre \/ sortir des animaux/);
  assert.match(session, /sessions\/\$\{initialSession\.id\}\/vente/);
  assert.match(page, /initialAnimalIds=\{initialAnimalIds\}/);
  assert.match(page, /sessionWeights/);
});

test("Pesée rapide ne conserve que la vraie séance active", () => {
  assert.match(quickWeighing, /canResumeFieldSession\(known\.status\)/);
  assert.match(quickWeighing, /La séance précédente est terminée\. Une nouvelle séance est prête\./);
  assert.match(quickWeighing, /sessionFromServer\(canonical, localSessionForActive\)/);
});

test("Pesée rapide clôture la séance avant d’ouvrir la vente groupée", () => {
  assert.match(quickWeighing, /VENDRE \/ SORTIR DES ANIMAUX/g);
  assert.match(quickWeighing, /TERMINER LA SÉANCE/g);
  assert.match(quickWeighing, /transitionFieldSession\(activeSession\.weighingSessionId, "finish"\)/);
  assert.match(quickWeighing, /router\.push\(`\/troupeau\/pesee\/sessions\/\$\{activeSession\.weighingSessionId\}\/vente`\)/);
});

test("le formulaire permet de décocher, ajouter et compter les animaux", () => {
  assert.match(modal, /toggleAnimalSelection/);
  assert.match(modal, /animalIds\.length} sélectionné/);
  assert.match(modal, /type="checkbox"/);
  assert.match(form, /initialAnimalIds=\{initialAnimalIds\}/);
});

test("une seule validation crée toutes les sorties dans une transaction", () => {
  assert.match(form, /fetch\("\/api\/sorties"/);
  assert.match(route, /groupedAnimalIds\.length > 0/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /animals\.map/);
  assert.match(route, /statut: "SORTI"/);
});
