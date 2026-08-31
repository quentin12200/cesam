import assert from "node:assert/strict";
import test from "node:test";
import {
  calculerDateLimiteUtilisation,
  calculerActionVaccinale,
  calculerFenetreVaccinale,
  calculerRappelPrimo,
  dateDansFenetre,
  determinerProchaineInjection,
  reliquatFlacon,
  reliquatUtilisableA,
  proposerConditionnements,
  resoudreRegleConservation,
  statutApresInjection,
} from "./vaccine-planner.ts";

const utc = (value: string) => new Date(`${value}T12:00:00.000Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);

test("la règle du médicament est héritée sans override du conditionnement", () => {
  const regle = resoudreRegleConservation(
    {
      conservationOuvertureStatut: "CONSERVABLE",
      conservationOuvertureJours: 28,
      conservationOuvertureCondition: "Réfrigérateur",
      conservationOuvertureSource: "RCP",
    },
    { conservationOuvertureStatut: null }
  );
  assert.deepEqual(regle, {
    statut: "CONSERVABLE",
    jours: 28,
    condition: "Réfrigérateur",
    source: "RCP",
    note: null,
    origine: "MEDICAMENT",
  });
});

test("un override conditionnement, y compris INCONNUE, remplace la règle médicament", () => {
  const medicament = { conservationOuvertureStatut: "CONSERVABLE", conservationOuvertureJours: 28 };
  assert.equal(resoudreRegleConservation(medicament, {
    conservationOuvertureStatut: "IMMEDIATE",
  }).statut, "IMMEDIATE");
  const inconnue = resoudreRegleConservation(medicament, {
    conservationOuvertureStatut: "INCONNUE",
    conservationOuvertureJours: 28,
  });
  assert.equal(inconnue.statut, "INCONNUE");
  assert.equal(inconnue.jours, null);
  assert.equal(inconnue.origine, "CONDITIONNEMENT");
});

test("une conservation de 28 jours accepte J+28 et refuse J+29", () => {
  const ouverture = utc("2026-09-05");
  const regle = { statut: "CONSERVABLE" as const, jours: 28 };
  assert.equal(iso(calculerDateLimiteUtilisation(ouverture, regle)!), "2026-10-03");
  assert.equal(reliquatUtilisableA(ouverture, utc("2026-10-03"), regle), true);
  assert.equal(reliquatUtilisableA(ouverture, utc("2026-10-04"), regle), false);
});

test("IMMEDIATE ne permet que le jour d'ouverture et INCONNUE aucun futur", () => {
  const ouverture = utc("2026-09-05");
  assert.equal(reliquatUtilisableA(ouverture, utc("2026-09-05"), { statut: "IMMEDIATE", jours: null }), true);
  assert.equal(reliquatUtilisableA(ouverture, utc("2026-09-06"), { statut: "IMMEDIATE", jours: null }), false);
  assert.equal(reliquatUtilisableA(ouverture, utc("2026-09-05"), { statut: "INCONNUE", jours: null }), false);
});

test("le reliquat est recalculé depuis les utilisations, y compris après correction", () => {
  assert.equal(reliquatFlacon(20, Array.from({ length: 10 }, () => ({ dosesUtilisees: 1 }))), 10);
  assert.equal(reliquatFlacon(20, Array.from({ length: 20 }, () => ({ dosesUtilisees: 1 }))), 0);
  const utilisations = [{ dosesUtilisees: 1 }, { dosesUtilisees: 1 }];
  assert.equal(reliquatFlacon(20, utilisations), 18);
  assert.equal(reliquatFlacon(20, utilisations.slice(0, 1)), 19);
  assert.equal(reliquatFlacon(20, [{ dosesUtilisees: 0.5 }]), 19.5);
});

test("une dose administrée de 2 ml reste distincte d'une dose commerciale", () => {
  const vaccination = { dose: 2, unite: "ml" };
  const utilisation = { dosesUtilisees: 1 };
  assert.equal(vaccination.dose, 2);
  assert.equal(utilisation.dosesUtilisees, 1);
  assert.equal(reliquatFlacon(20, [utilisation]), 19);
});

test("la fenêtre entretien est inclusive de J-90 à J-21", () => {
  const velage = utc("2026-12-04");
  const fenetre = calculerFenetreVaccinale(velage, "ENTRETIEN");
  assert.equal(iso(fenetre.debut), "2026-09-05");
  assert.equal(iso(fenetre.fin), "2026-11-13");
  assert.equal(dateDansFenetre(utc("2026-09-04"), fenetre), false);
  assert.equal(dateDansFenetre(utc("2026-09-05"), fenetre), true);
  assert.equal(dateDansFenetre(utc("2026-11-13"), fenetre), true);
  assert.equal(dateDansFenetre(utc("2026-11-14"), fenetre), false);
});

test("PRIMO 1 est limitée à J-90/J-49 pour laisser le rappel à 28 jours", () => {
  const velage = utc("2026-12-04");
  const fenetre = calculerFenetreVaccinale(velage, "PRIMO_1");
  assert.equal(iso(fenetre.debut), "2026-09-05");
  assert.equal(iso(fenetre.fin), "2026-10-16");
  assert.equal(calculerRappelPrimo(utc("2026-10-16"), velage).possible, true);
  assert.equal(iso(calculerRappelPrimo(utc("2026-10-16"), velage).date), "2026-11-13");
  assert.equal(calculerRappelPrimo(utc("2026-10-17"), velage).possible, false);
});

test("le statut suit primo puis rappel sans conclure depuis un historique absent", () => {
  assert.equal(statutApresInjection("A_CONFIRMER", "PRIMO_1"), "PRIMO_EN_COURS");
  assert.equal(statutApresInjection("PRIMO_EN_COURS", "RAPPEL"), "PROTOCOLE_ACQUIS");
  assert.equal(statutApresInjection("A_CONFIRMER", "ENTRETIEN"), "A_CONFIRMER");
});

test("l'entretien est raisonné pour le cycle de vêlage fourni", () => {
  const velage = utc("2026-12-04");
  const aFaire = determinerProchaineInjection({ statut: "PROTOCOLE_ACQUIS", dateVelagePrevue: velage, vaccinationsCycle: [] });
  assert.equal(aFaire.type, "ENTRETIEN");
  const couvert = determinerProchaineInjection({ statut: "PROTOCOLE_ACQUIS", dateVelagePrevue: velage, vaccinationsCycle: [{ date: utc("2026-09-20"), type: "ENTRETIEN" }] });
  assert.equal(couvert.couvert, true);
  assert.equal(couvert.type, null);
});

test("un historique absent reste à confirmer et un primo en cours expose son rappel", () => {
  const velage = utc("2026-12-04");
  assert.equal(determinerProchaineInjection({ statut: "A_CONFIRMER", dateVelagePrevue: velage, vaccinationsCycle: [] }).aConfirmer, true);
  const rappel = determinerProchaineInjection({ statut: "PRIMO_EN_COURS", dateVelagePrevue: velage, vaccinationsCycle: [{ date: utc("2026-09-05"), type: "PRIMO_1" }] });
  assert.equal(rappel.type, "RAPPEL");
  assert.equal(iso(rappel.fenetre!.debut), "2026-10-03");
});

const etape = (overrides: Partial<{
  id: string; label: string; ordre: number; cycle: string; reference: string;
  debutValeur: number; debutUnite: string; debutPosition: string;
  finValeur: number; finUnite: string; finPosition: string; recurrenceMois: number | null;
}> = {}) => ({
  id: "e1", label: "Injection", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE",
  debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES",
  finValeur: 30, finUnite: "JOUR", finPosition: "APRES", recurrenceMois: null,
  ...overrides,
});

test("un vaccin dès la naissance rend le veau J0 éligible", () => {
  const action = calculerActionVaccinale({ date: utc("2026-08-31"), dateNaissance: utc("2026-08-31"), etapes: [etape()], vaccinations: [] });
  assert.equal(action.statut, "A_FAIRE");
  assert.equal(iso(action.dateMin!), "2026-08-31");
});

test("l'âge minimum combiné garde un animal trop jeune hors préparation", () => {
  const action = calculerActionVaccinale({ date: utc("2026-08-31"), dateNaissance: utc("2026-08-21"), ageMinJours: 20, etapes: [etape()], vaccinations: [] });
  assert.equal(action.statut, "A_PREVOIR");
  assert.equal(iso(action.dateMin!), "2026-09-10");
});

test("une fenêtre avant vêlage conserve ses deux bornes", () => {
  const action = calculerActionVaccinale({
    date: utc("2026-09-05"), dateNaissance: utc("2022-01-01"), dateVelagePrevue: utc("2026-12-04"),
    etapes: [etape({ reference: "VELAGE", debutValeur: 90, debutPosition: "AVANT", finValeur: 21, finPosition: "AVANT" })], vaccinations: [],
  });
  assert.equal(action.statut, "A_FAIRE");
  assert.equal(iso(action.dateMin!), "2026-09-05");
  assert.equal(iso(action.dateMax!), "2026-11-13");
});

test("la primo 1 mène à la primo 2 selon l'intervalle configuré", () => {
  const etapes = [etape({ label: "Primo 1/2" }), etape({ id: "e2", label: "Primo 2/2", ordre: 1, reference: "ETAPE_PRECEDENTE", debutValeur: 28, finValeur: 28 })];
  const action = calculerActionVaccinale({ date: utc("2026-09-28"), dateNaissance: utc("2026-09-01"), etapes, vaccinations: [{ date: utc("2026-09-01"), etapeProtocoleId: "e1" }] });
  assert.equal(action.etape?.id, "e2");
  assert.equal(iso(action.dateMin!), "2026-09-29");
});

test("la primo 1 est refusée si la primo 2 sortirait de la limite d'âge", () => {
  const etapes = [etape({ label: "Primo 1/2", finValeur: 100 }), etape({ id: "e2", label: "Primo 2/2", ordre: 1, reference: "ETAPE_PRECEDENTE", debutValeur: 28, finValeur: 28 })];
  const action = calculerActionVaccinale({ date: utc("2026-03-25"), dateNaissance: utc("2026-01-01"), ageMaxJours: 100, etapes, vaccinations: [] });
  assert.equal(action.statut, "EN_RETARD");
});

test("un rappel annuel repart de la dernière vaccination", () => {
  const rappel = etape({ cycle: "ENTRETIEN", recurrenceMois: 12 });
  const action = calculerActionVaccinale({ date: utc("2026-08-31"), dateNaissance: utc("2024-01-01"), etapes: [rappel], vaccinations: [{ date: utc("2025-08-31"), etapeProtocoleId: "e1" }] });
  assert.equal(action.statut, "A_FAIRE");
  assert.equal(iso(action.dateMin!), "2026-08-31");
});

test("un protocole sans étape restante est terminé", () => {
  const action = calculerActionVaccinale({ date: utc("2026-08-31"), dateNaissance: utc("2026-08-01"), etapes: [etape()], vaccinations: [{ date: utc("2026-08-10"), etapeProtocoleId: "e1" }] });
  assert.equal(action.statut, "TERMINE");
});

test("la préparation privilégie le reliquat valide puis complète en conditionnements", () => {
  assert.deepEqual(proposerConditionnements({ dosesNecessaires: 14, reliquatsUtilisables: [4], conditionnements: [5] }), {
    reliquatUtilise: 4, nombre: 2, dosesParConditionnement: 5, totalDisponible: 14,
  });
});
