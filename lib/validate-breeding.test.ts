import test from "node:test";
import assert from "node:assert/strict";
import { validateBreedingInput } from "./validate-breeding.ts";

const valid = { animalId: "animal-fictif-1", date: "2026-11-09", type: "IA" };
test("IA fictive valide sans taureau", () => assert.equal(validateBreedingInput(valid).ok, true));
test("saillie naturelle fictive avec taureau", () => assert.equal(validateBreedingInput({ ...valid, type: "NATURELLE", taureauId: "taureau-fictif" }).ok, true));
test("date impossible refusée", () => assert.equal(validateBreedingInput({ ...valid, date: "2026-02-30" }).ok, false));
test("date mal formée refusée", () => assert.equal(validateBreedingInput({ ...valid, date: "hier" }).ok, false));
test("animal absent refusé", () => assert.equal(validateBreedingInput({ ...valid, animalId: "" }).ok, false));
test("identifiant animal non textuel refusé", () => assert.equal(validateBreedingInput({ ...valid, animalId: 42 }).ok, false));
test("liste mixte invalide refusée", () => assert.equal(validateBreedingInput({ ...valid, animalIds: ["animal-fictif-1", null] }).ok, false));
test("type inconnu refusé", () => assert.equal(validateBreedingInput({ ...valid, type: "AUTRE" }).ok, false));
test("taureau vide refusé", () => assert.equal(validateBreedingInput({ ...valid, taureauId: "" }).ok, false));
test("tentative négative refusée", () => assert.equal(validateBreedingInput({ ...valid, tentative: -1 }).ok, false));
test("doublons animaux dédupliqués", () => { const result = validateBreedingInput({ ...valid, animalIds: ["a", "a"] }); assert.equal(result.ok, true); if (result.ok) assert.deepEqual(result.animalIds, ["a"]); });
