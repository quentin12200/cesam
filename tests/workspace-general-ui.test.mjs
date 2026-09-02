import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../app/prototype-espace-travail/", import.meta.url);

async function source(file) {
  return readFile(new URL(file, ROOT), "utf8");
}

test("l’espace de travail couvre plusieurs familles d’actions", async () => {
  const [types, panel] = await Promise.all([
    source("types.ts"),
    source("WorkspaceSelectionPanel.tsx"),
  ]);

  for (const action of ["treatment", "vaccination", "echo", "weaning", "move", "weight", "sale"]) {
    assert.match(types, new RegExp(`"${action}"`));
  }
  for (const group of ["Sanitaire", "Reproduction", "Troupeau", "Mesures et sortie"]) {
    assert.match(panel, new RegExp(group));
  }
});

test("la table relie veaux et mères et permet leurs tris indépendants", async () => {
  const [list, workspace, panel] = await Promise.all([
    source("WorkspaceAnimalList.tsx"),
    source("PrototypeWorkspace.tsx"),
    source("WorkspaceSelectionPanel.tsx"),
  ]);

  assert.match(list, /Animal lié/);
  assert.match(list, /Mère associée/);
  assert.match(list, /Mère vide · arbitrer le sevrage/);
  assert.match(workspace, /Numéro mère \/ lié/);
  assert.match(workspace, /related-number/);
  assert.match(panel, /Garder les .* à échographier/);
});

test("la séance peut être reprise avec sa sélection et son historique", async () => {
  const [workspace, session] = await Promise.all([
    source("PrototypeWorkspace.tsx"),
    source("WorkspaceSessionBar.tsx"),
  ]);

  assert.match(workspace, /cesam:prototype-workspace-session:v2/);
  assert.match(workspace, /localStorage\.setItem/);
  assert.match(workspace, /La sélection est conservée/);
  assert.match(session, /Séance du jour/);
  assert.match(session, /sauvegarde automatique/);
  assert.match(session, /Dernier travail/);
});

test("les vues se comportent comme un tableau dynamique", async () => {
  const [types, workspace] = await Promise.all([
    source("types.ts"),
    source("PrototypeWorkspace.tsx"),
  ]);

  for (const view of ["today", "all", "young-related", "cows", "reproduction", "weaning"]) {
    assert.match(types, new RegExp(`"${view}"`));
  }
  assert.match(workspace, /Colonnes/);
  assert.match(workspace, /Toutes les tâches/);
  assert.match(workspace, /Les vues, tris et colonnes changent/);
});
