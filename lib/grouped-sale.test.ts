import assert from "node:assert/strict";
import test from "node:test";
import { groupedSaleTotal, toggleAnimalSelection, uniqueAnimalIds, claimAnimalForExit, undoExitInTransaction, buildExitPatch } from "./grouped-sale.ts";

test("présélectionne chaque animal une seule fois", () => {
  assert.deepEqual(uniqueAnimalIds(["veau-1", "veau-2", "veau-1"]), ["veau-1", "veau-2"]);
});

test("permet de décocher puis d'ajouter un animal", () => {
  assert.deepEqual(toggleAnimalSelection(["veau-1", "veau-2"], "veau-1"), ["veau-2"]);
  assert.deepEqual(toggleAnimalSelection(["veau-2"], "veau-3"), ["veau-2", "veau-3"]);
});

test("calcule le total avec le poids propre à chaque animal", () => {
  assert.equal(groupedSaleTotal(["veau-1", "veau-2"], { "veau-1": "310", "veau-2": "290" }, "3.50"), 2100);
});

test("une vente groupée fictive ne compte pas deux fois le même veau", () => {
  const ids = uniqueAnimalIds(["veau-A", "veau-B", "veau-A"]);
  assert.equal(ids.length, 2);
  assert.equal(groupedSaleTotal(ids, { "veau-A": "350", "veau-B": "420" }, "4.80"), 3696);
});

test("une vente groupée sans poids exploitable n'invente pas de montant", () => {
  assert.equal(groupedSaleTotal(["veau-A"], { "veau-A": "" }, "4.80"), null);
  assert.equal(groupedSaleTotal(["veau-A"], { "veau-A": "350" }, "0"), null);
});


test("deux ventes concurrentes fictives : une seule acquiert le verrou", async () => {
  let status = "ACTIF";
  const updateMany = async ({ where, data }: { where: { id: string; statut: string }; data: { statut: string; updatedAt: Date } }) => {
    if (where.id !== "veau-A" || status !== where.statut) return { count: 0 };
    status = data.statut;
    return { count: 1 };
  };
  const results = await Promise.allSettled([
    claimAnimalForExit("veau-A", updateMany),
    claimAnimalForExit("veau-A", updateMany),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(status, "SORTI");
});

test("annulation fictive : restaure ACTIF seulement après suppression de la dernière sortie", async () => {
  let remaining = 1;
  let status = "SORTI";
  const tx = {
    sortie: {
      delete: async () => { remaining--; },
      count: async () => remaining,
    },
    animal: { update: async ({ data }: { data: { statut: string; updatedAt: Date } }) => { status = data.statut; } },
  };
  assert.equal(await undoExitInTransaction("sortie-1", "veau-A", tx), true);
  assert.equal(status, "ACTIF");
});

test("annulation fictive : ne réactive pas si une autre sortie existe", async () => {
  let remaining = 2;
  let updated = false;
  const tx = {
    sortie: { delete: async () => { remaining--; }, count: async () => remaining },
    animal: { update: async () => { updated = true; } },
  };
  assert.equal(await undoExitInTransaction("sortie-1", "veau-A", tx), false);
  assert.equal(updated, false);
});

test("modification fictive : modifier le poids d'un veau ne change pas celui de l'autre", () => {
  const weights = { "veau-A": "350", "veau-B": "420" };
  const modified = { ...weights, "veau-A": "365" };
  assert.equal(groupedSaleTotal(["veau-A", "veau-B"], modified, "4.80"), 3768);
  assert.equal(modified["veau-B"], weights["veau-B"]);
});

test("PATCH fictif : corrige un poids et conserve notes, cause et données non fournies", () => {
  const previous = { poids: 350, prixKilo: 4.8, notes: "Observation individuelle", causeMortalite: "Accident" };
  const patch = buildExitPatch({ poids: 365 }, previous);
  assert.equal(patch.poids, 365);
  assert.equal(patch.prixPrevuHT, 1752);
  assert.equal(Object.hasOwn(patch, "notes"), false);
  assert.equal(Object.hasOwn(patch, "causeMortalite"), false);
  assert.deepEqual({ ...previous, ...patch }.notes, previous.notes);
});

test("PATCH fictif : effacement explicite sans écraser les autres champs", () => {
  const patch = buildExitPatch({ notes: "", prixKilo: null }, { poids: 300, prixKilo: 4.8 });
  assert.equal(patch.notes, null);
  assert.equal(patch.prixKilo, null);
  assert.equal(patch.prixPrevuHT, null);
  assert.equal(Object.hasOwn(patch, "causeMortalite"), false);
});

test("PATCH fictif : refuse valeurs non finies, négatives et date invalide", () => {
  for (const payload of [{ poids: -1 }, { poids: "abc" }, { prixKilo: -2 }, { date: "invalide" }]) {
    assert.throws(() => buildExitPatch(payload, { poids: 350, prixKilo: 4.8 }));
  }
});

test("annulation fictive concurrente : la seconde suppression échoue sans réactivation supplémentaire", async () => {
  let present = true;
  let updates = 0;
  const tx = {
    sortie: {
      delete: async () => { if (!present) throw new Error("P2025"); present = false; },
      count: async () => present ? 1 : 0,
    },
    animal: { update: async () => { updates++; } },
  };
  const results = await Promise.allSettled([
    undoExitInTransaction("sortie-A", "veau-A", tx),
    undoExitInTransaction("sortie-A", "veau-A", tx),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(updates, 1);
});

test("annulation fictive : échec de suppression ne modifie pas le statut", async () => {
  let updated = false;
  const tx = {
    sortie: { delete: async () => { throw new Error("P2025"); }, count: async () => 0 },
    animal: { update: async () => { updated = true; } },
  };
  await assert.rejects(undoExitInTransaction("sortie-A", "veau-A", tx));
  assert.equal(updated, false);
});
