import assert from "node:assert/strict";
import test from "node:test";
import { construireMatriceVaccinale } from "./vaccine-matrix.ts";
import { calculerActionVaccinale } from "./vaccine-planner.ts";
import { gestationIdAEnregistrer, vaccinationAppartientAuCycleCourant } from "./vaccination-session.ts";

test("une ligne par veau et deux colonnes distinctes pour Nasalgen et Bovilis Intranasal", () => {
  const date = new Date("2026-09-18T12:00:00Z");
  const matrice = construireMatriceVaccinale([
    { id: "veau-7511", nutrav: "7511", nom: "Belladonna", vaccinations: [
      { vaccin: "NASALGEN", date, statut: "FAIT" },
      { vaccin: "BOVILIS INTRANASAL RSP LIVE", date, statut: "FAIT" },
    ] },
  ], []);
  assert.equal(matrice.lignes.length, 1);
  assert.deepEqual(matrice.vaccins.map((v) => v.cle), ["BOVILIS INTRANASAL RSP LIVE", "NASALGEN"]);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits[0].date, date);
  assert.equal(matrice.lignes[0].cases["BOVILIS INTRANASAL RSP LIVE"].faits[0].date, date);
});

test("la case Bovigrip montre le fait et le rappel à faire, puis le rappel fait", () => {
  const primo = new Date("2026-09-11T12:00:00Z");
  const rappel = new Date("2026-10-09T12:00:00Z");
  const animal = { id: "7487", nutrav: "7487", nom: "Badboy", vaccinations: [{ vaccin: "BOVILIS BOVIGRIP", date: primo, statut: "FAIT" }] };
  const preparation = { vaccin: "BOVILIS BOVIGRIP", lignes: [{ animalId: "7487", vaccin: "BOVILIS BOVIGRIP", injection: "Rappel", dateMin: rappel, dateMax: rappel }], aConfirmer: [] };
  const aFaire = construireMatriceVaccinale([animal], [preparation]).lignes[0].cases["BOVILIS BOVIGRIP"];
  assert.equal(aFaire.faits[0].date, primo);
  assert.equal(aFaire.aFaire?.dateMin, rappel);
  const fait = construireMatriceVaccinale([{ ...animal, vaccinations: [...animal.vaccinations, { vaccin: "BOVILIS BOVIGRIP", date: rappel, statut: "FAIT" }] }], []).lignes[0].cases["BOVILIS BOVIGRIP"];
  assert.equal(fait.faits.length, 2);
  assert.equal(fait.aFaire, null);
});

test("un ancien libellé rappel rejoint sa colonne produit sans compter un acte prévu comme fait", () => {
  const matrice = construireMatriceVaccinale([{ id: "1", nutrav: "1", nom: null, vaccinations: [
    { vaccin: "NASALGEN", date: new Date("2026-01-01"), statut: "FAIT" },
    { vaccin: "NASALGEN_RAPPEL", date: new Date("2026-04-01"), statut: "FAIT" },
    { vaccin: "NASALGEN", date: new Date("2026-05-01"), statut: "PREVU" },
  ] }], []);
  assert.deepEqual(matrice.vaccins.map((v) => v.cle), ["NASALGEN"]);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits.length, 2);
  assert.equal(matrice.lignes[0].cases.NASALGEN.faits[1].rappel, true);
});

test("une vaccination sur l'étape non VELAGE du cycle courant est faite sans à-faire contradictoire", () => {
  const gestationId = "gestation-courante";
  const dateVelagePrevue = new Date("2026-12-04T12:00:00Z");
  const datePremiereInjection = new Date("2026-09-05T12:00:00Z");
  const dateDeuxiemeInjection = new Date("2026-10-03T12:00:00Z");
  const etapes = [
    {
      id: "avant-velage", label: "Primo 1/2", ordre: 0, cycle: "INITIAL", reference: "VELAGE",
      debutValeur: 90, debutUnite: "JOUR", debutPosition: "AVANT",
      finValeur: 21, finUnite: "JOUR", finPosition: "AVANT", recurrenceMois: null,
    },
    {
      id: "rappel", label: "Primo 2/2", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE",
      debutValeur: 28, debutUnite: "JOUR", debutPosition: "APRES",
      finValeur: 28, finUnite: "JOUR", finPosition: "APRES", recurrenceMois: null,
    },
  ] as const;
  const vaccinationsEnregistrees = [
    { date: datePremiereInjection, etapeProtocoleId: "avant-velage", gestationId },
    {
      date: dateDeuxiemeInjection,
      etapeProtocoleId: "rappel",
      gestationId: gestationIdAEnregistrer(etapes, gestationId),
    },
  ];
  const vaccinationsDuCycle = vaccinationsEnregistrees.filter((vaccination) =>
    vaccinationAppartientAuCycleCourant(true, vaccination.gestationId, gestationId)
  );
  const action = calculerActionVaccinale({
    date: dateDeuxiemeInjection,
    dateNaissance: new Date("2022-01-01T12:00:00Z"),
    dateVelagePrevue,
    etapes,
    vaccinations: vaccinationsDuCycle,
  });
  const preparations = action.etape && action.dateMin && action.dateMax ? [{
    vaccin: "VACCIN VELAGE",
    lignes: [{
      animalId: "vache-1",
      vaccin: "VACCIN VELAGE",
      injection: action.etape.label,
      dateMin: action.dateMin,
      dateMax: action.dateMax,
    }],
    aConfirmer: [],
  }] : [];
  const cellule = construireMatriceVaccinale([{
    id: "vache-1",
    nutrav: "1234",
    nom: null,
    vaccinations: [{ vaccin: "VACCIN VELAGE", date: dateDeuxiemeInjection, statut: "FAIT" }],
  }], preparations).lignes[0].cases["VACCIN VELAGE"];

  assert.equal(vaccinationsEnregistrees[1].gestationId, gestationId);
  assert.equal(action.statut, "TERMINE");
  assert.equal(cellule.faits[0].date, dateDeuxiemeInjection);
  assert.equal(cellule.aFaire, null);
});
