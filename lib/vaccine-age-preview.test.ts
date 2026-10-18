import assert from "node:assert/strict";
import test from "node:test";
import { previsualiserLimiteAge, type AnimalApercuAge, type CibleApercuAge } from "./vaccine-age-preview.ts";

const cible: CibleApercuAge = {
  medicamentId: "intranasal", protocoleId: "pro-1", categories: ["VEAU"],
  sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null,
};
const animal = (danaisIso: string, extra: Partial<AnimalApercuAge> = {}): AnimalApercuAge => ({
  danaisIso, categorie: "VEAU_M", sexe: "M", groupeNom: null,
  nombreVelages: 0, gestation: false, vaccinsFaitsIds: [],
  statutsProtocoles: [], ...extra,
});
const date = new Date("2026-10-18T12:00:00.000Z");
const APRES_30 = { valeur: 30, unite: "JOUR" } as const;
const APRES_90 = { valeur: 90, unite: "JOUR" } as const;
const calcul = (animaux: AnimalApercuAge[], ancienneLimite: typeof APRES_30 | typeof APRES_90 | null, nouvelleLimite: typeof APRES_30 | typeof APRES_90 | null) =>
  previsualiserLimiteAge({ animaux, cible, ancienneLimite, nouvelleLimite, date });
test("présente le nombre d'animaux qui sortiraient du programme", () => {
  assert.deepEqual(calcul([animal("2026-09-01T00:00:00Z"), animal("2026-10-10T00:00:00Z")], null, APRES_30), {
    deviendraientHorsProgramme: 1, reviendraientDansProgramme: 0, candidatsSansPremiereInjection: 2,
  });
});
test("à l'âge limite exact, la vaccination peut encore commencer", () => {
  assert.equal(calcul([animal("2026-09-18T00:00:00Z")], null, APRES_30).deviendraientHorsProgramme, 0);
});
test("étendre la fenêtre réactive, sans jamais créer d'acte", () => {
  assert.equal(calcul([animal("2026-09-01T00:00:00Z")], APRES_30, APRES_90).reviendraientDansProgramme, 1);
});
test("acte réalisé ou historique incertain : aucune exclusion automatique", () => {
  const animaux = [
    animal("2026-01-01T00:00:00Z", { vaccinsFaitsIds: ["intranasal"] }),
    animal("2026-01-01T00:00:00Z", { statutsProtocoles: [{ protocoleId: "pro-1", statut: "A_CONFIRMER" }] }),
    animal("2026-01-01T00:00:00Z", { statutsProtocoles: [{ protocoleId: "pro-1", statut: "PRIMO_EN_COURS" }] }),
  ];
  assert.equal(calcul(animaux, null, APRES_30).deviendraientHorsProgramme, 0);
});
test("la sélection du protocole filtre les autres catégories", () => {
  assert.equal(calcul([animal("2026-01-01T00:00:00Z", { categorie: "VACHE", sexe: "F" })], null, APRES_30).deviendraientHorsProgramme, 0);
});
