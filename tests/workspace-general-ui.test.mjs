import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../app/prototype-espace-travail/", import.meta.url);

async function source(file) {
  return readFile(new URL(file, ROOT), "utf8");
}

test("les actions rapides restent générales mais proches de la sélection", async () => {
  const [types, panel, bulkBar, workspace] = await Promise.all([
    source("types.ts"),
    source("WorkspaceSelectionPanel.tsx"),
    source("WorkspaceBulkBar.tsx"),
    source("PrototypeWorkspace.tsx"),
  ]);

  for (const action of ["treatment", "vaccination", "echo", "weaning", "move", "weight", "sale"]) {
    assert.match(types, new RegExp(`"${action}"`));
  }
  assert.match(panel, /Actions rapides/);
  assert.match(panel, /Que voulez-vous faire/);
  assert.match(bulkBar, /Actions sur les animaux sélectionnés/);
  assert.match(workspace, /<WorkspaceBulkBar/);
  assert.doesNotMatch(workspace, /WorkspaceSessionBar|Préparer les 15|Nouvelle séance/);
});

test("la vue sevrage montre et trie directement les couples veau-mère", async () => {
  const [list, workspace, panel] = await Promise.all([
    source("WorkspaceAnimalList.tsx"),
    source("PrototypeWorkspace.tsx"),
    source("WorkspaceSelectionPanel.tsx"),
  ]);

  assert.match(list, /primary: "Veau", related: "Mère", reproduction: "État de la mère"/);
  assert.match(list, /Mère associée/);
  assert.match(list, /Mère vide · sevrage à arbitrer/);
  assert.match(list, /related-number/);
  assert.match(panel, /Voir les mères triées par numéro/);
  assert.match(workspace, /setView\("cows"\)/);
  assert.match(workspace, /setSort\("primary-number"\)/);
});

test("le tableau tient dans la largeur et se trie depuis ses en-têtes", async () => {
  const list = await source("WorkspaceAnimalList.tsx");

  assert.match(list, /table-fixed/);
  assert.match(list, /Sélectionner les .* visibles/);
  assert.match(list, /SortableHeader label="Âge"/);
  assert.doesNotMatch(list, /overflow-x-auto|min-w-\[860px\]|Ajouter la vue|Garder la vue/);
});

test("une échéance recommande une action sans la rendre incompatible", async () => {
  const utils = await source("workspace-utils.ts");

  assert.doesNotMatch(utils, /action === "vaccination"[\s\S]{0,100}vaccinationDue/);
  assert.doesNotMatch(utils, /action === "echo"[\s\S]{0,180}echoDue/);
  assert.match(utils, /action === "echo"/);
  assert.match(utils, /animal\.kind === "VACHE" \|\| animal\.kind === "GENISSE"/);
});

test("l’échographie reprend une saisie différente pour chaque femelle", async () => {
  const modal = await source("WorkspaceActionModal.tsx");

  assert.match(modal, /Aperçu du formulaire CESAM/);
  assert.match(modal, /Saisie individuelle/);
  assert.match(modal, /Chaque vache peut avoir un résultat et un stade différents/);
  assert.match(modal, /Pleine/);
  assert.match(modal, /Vide/);
  assert.match(modal, /Stade de gestation/);
});

test("la sélection et le travail simulé sont conservés sans notion de séance", async () => {
  const workspace = await source("PrototypeWorkspace.tsx");

  assert.match(workspace, /cesam:prototype-workspace:v3/);
  assert.match(workspace, /localStorage\.setItem/);
  assert.match(workspace, /La sélection est conservée/);
  assert.doesNotMatch(workspace, /session|séance|Séance/);
});
