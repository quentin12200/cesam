import assert from "node:assert/strict";
import test from "node:test";
import { compterVaccinationsVisibles, type CelluleCompte } from "./vaccine-header-counts.ts";

const cell = (statut: CelluleCompte["statut"], options: Partial<CelluleCompte> = {}): CelluleCompte => ({
  statut, aValider: false, prochaine: null, ...options,
});
const blocs = [{ cle: "hepizovac", sousColonnes: [{ id: "primo" }, { id: "rappel" }] }];
const animal = (animalId: string, cellules: Record<string, CelluleCompte>) => ({ animalId, cellules });

test("compte à faire et retard, mais pas bientôt, prévu, fait, vide, ni à rattacher", () => {
  const lignes = [
    animal("1", { primo: cell("A_FAIRE") }),
    animal("2", { primo: cell("EN_RETARD") }),
    animal("3", { primo: cell("BIENTOT") }),
    animal("4", { primo: cell("PREVU") }),
    animal("5", { primo: cell("FAIT") }),
    animal("6", { primo: cell("VIDE") }),
    animal("7", { primo: cell("A_FAIRE", { aValider: true }) }),
  ];
  const resultat = compterVaccinationsVisibles(lignes, blocs).hepizovac;
  assert.deepEqual(resultat.total, { aFaire: 2, enRetard: 1 });
  assert.deepEqual(resultat.etapes.primo, { aFaire: 2, enRetard: 1 });
  assert.deepEqual(resultat.etapes.rappel, { aFaire: 0, enRetard: 0 });
});

test("une étape faite avec prochaine échéance compte le rappel à faire", () => {
  const resultat = compterVaccinationsVisibles([
    animal("1", { rappel: cell("FAIT", { prochaine: { statut: "EN_RETARD" } }) }),
    animal("2", { rappel: cell("FAIT", { prochaine: { statut: "PREVU" } }) }),
  ], blocs).hepizovac;
  assert.deepEqual(resultat.total, { aFaire: 1, enRetard: 1 });
  assert.deepEqual(resultat.etapes.rappel, { aFaire: 1, enRetard: 1 });
});

test("ne double pas le même animal au total du vaccin ; distingue Primo et Rappel", () => {
  const lignes = [animal("1", { primo: cell("EN_RETARD"), rappel: cell("A_FAIRE") })];
  const resultat = compterVaccinationsVisibles(lignes, blocs).hepizovac;
  assert.deepEqual(resultat.total, { aFaire: 1, enRetard: 1 });
  assert.deepEqual(resultat.etapes.primo, { aFaire: 1, enRetard: 1 });
  assert.deepEqual(resultat.etapes.rappel, { aFaire: 1, enRetard: 0 });
});

test("compte seulement les animaux visibles et dédoublonne les lignes répétées", () => {
  const lignes = [animal("1", { primo: cell("A_FAIRE") }), animal("1", { primo: cell("A_FAIRE") })];
  assert.equal(compterVaccinationsVisibles(lignes, blocs).hepizovac.total.aFaire, 1);
  assert.equal(compterVaccinationsVisibles([], blocs).hepizovac.total.aFaire, 0);
});

test("vaccin sans protocole et cellule sans échéance : zéro recommandé", () => {
  const resultat = compterVaccinationsVisibles([animal("1", { "libre": cell("VIDE") })], [{ cle: "libre", sousColonnes: [{ id: "libre" }] }]);
  assert.deepEqual(resultat.libre.total, { aFaire: 0, enRetard: 0 });
});
