import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTroupeauWhere,
  filtrerAnimauxParCriteresLocaux,
  getActiveTroupeauFilters,
  impliedSexForCategory,
  resetTroupeauSearchParams,
  updateTroupeauSearchParams,
} from "./troupeau-filters.ts";

const now = new Date("2026-08-23T12:00:00Z");
const animaux = [
  { id: "velle", sexbov: "F", danais: new Date("2026-01-01"), estGenisse: true, categorie: "VELLE", sevreFait: false },
  { id: "petite", sexbov: "F", danais: new Date("2025-11-01"), estGenisse: true, categorie: "PETITE_GENISSE", sevreFait: true },
  { id: "vache", sexbov: "F", danais: new Date("2021-01-01"), estGenisse: false, categorie: "VACHE", sevreFait: false },
  { id: "veau", sexbov: "M", danais: new Date("2026-02-01"), estGenisse: false, categorie: "VEAU_M", sevreFait: false },
  { id: "taureau", sexbov: "M", danais: new Date("2022-01-01"), estGenisse: false, categorie: "TAUREAU", sevreFait: true },
];

test("Petite génisse reste stricte et n'inclut jamais une Velle", () => {
  assert.deepEqual(
    filtrerAnimauxParCriteresLocaux(animaux, { categorie: "PETITE_GENISSE" }, now).map((animal) => animal.id),
    ["petite"]
  );
});

test("une catégorie suffit sans filtre Sexe et impose seulement le sexe cohérent au serveur", () => {
  assert.equal(impliedSexForCategory("PETITE_GENISSE"), "F");
  assert.equal(buildTroupeauWhere({ categorie: "PETITE_GENISSE" }).sexbov, "F");
  assert.deepEqual(filtrerAnimauxParCriteresLocaux(animaux, { categorie: "VELLE" }, now).map((animal) => animal.id), ["velle"]);
  assert.equal(buildTroupeauWhere({ categorie: "VEAU_M" }).sexbov, "M");
  assert.equal(buildTroupeauWhere({ categorie: "TAUREAU" }).sexbov, "M");
});

test("les filtres Non sevrés et Sevrés appliquent la règle métier d'âge", () => {
  assert.deepEqual(
    filtrerAnimauxParCriteresLocaux(animaux, { sevrage: "NON_SEVRE" }, now).map((animal) => animal.id),
    ["velle", "veau"]
  );
  assert.deepEqual(
    filtrerAnimauxParCriteresLocaux(animaux, { sevrage: "SEVRE" }, now).map((animal) => animal.id),
    ["petite", "vache", "taureau"]
  );
});

test("catégorie, reproduction et santé construisent une intersection commune", () => {
  const repro = buildTroupeauWhere({ categorie: "PETITE_GENISSE", repro: "PLEINE" });
  assert.equal(repro.sexbov, "F");
  assert.ok(repro.saillies);
  const health = buildTroupeauWhere({ categorie: "PETITE_GENISSE", sanitaire: "PROBLEME" });
  assert.equal(health.sexbov, "F");
  assert.deepEqual(health.evenements, { some: { resolu: false } });
});

test("l'URL préserve recherche et tri, évite le doublon Sexe/Catégorie et permet le reset", () => {
  const current = new URLSearchParams("q=8452&tri=age_desc&sexe=F&sanitaire=OK");
  const category = updateTroupeauSearchParams(current, "categorie", "PETITE_GENISSE");
  assert.equal(category.get("q"), "8452");
  assert.equal(category.get("tri"), "age_desc");
  assert.equal(category.get("categorie"), "PETITE_GENISSE");
  assert.equal(category.has("sexe"), false);

  const reset = resetTroupeauSearchParams(category);
  assert.equal(reset.get("q"), "8452");
  assert.equal(reset.get("tri"), "age_desc");
  assert.equal(reset.has("categorie"), false);
  assert.equal(reset.has("sanitaire"), false);
});

test("le compteur ne crée pas un filtre Femelle implicite", () => {
  const active = getActiveTroupeauFilters({ categorie: "PETITE_GENISSE", sevrage: "NON_SEVRE" });
  assert.deepEqual(active.map((item) => item.label), ["Petite génisse", "Non sevrés"]);
});

test("une catégorie mâle retire les filtres féminins incohérents", () => {
  const next = updateTroupeauSearchParams(
    new URLSearchParams("repro=PLEINE&tarie=oui"),
    "categorie",
    "TAUREAU"
  );
  assert.equal(next.get("categorie"), "TAUREAU");
  assert.equal(next.has("repro"), false);
  assert.equal(next.has("tarie"), false);
});
