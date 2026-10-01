import assert from "node:assert/strict";
import test from "node:test";
import { calculerFenetreEtape, type EtapeVaccinaleConfig } from "./vaccine-planner.ts";

const etapeRappel = (debutUnite: string, debutValeur = 4): EtapeVaccinaleConfig => ({
  id: "rappel", label: "Rappel", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE",
  debutValeur, debutUnite, debutPosition: "APRES", finValeur: 0, finUnite: "JOUR", finPosition: "APRES",
});

// L'étape réelle (finValeur:0) donne une fenêtre "à rebours" : calculerFenetreEtape remet
// debut/fin dans l'ordre chronologique, donc la date calculée à +N se retrouve en .fin.
test("une unité en minuscule (\"semaine\", cas réel du protocole Bovigrip en base) est interprétée en semaines, pas en jours", () => {
  const datePrimo = new Date("2026-09-11T12:00:00Z");
  const fenetre = calculerFenetreEtape({ etape: etapeRappel("semaine"), dateNaissance: new Date("2026-01-01T12:00:00Z"), dateEtapePrecedente: datePrimo });
  assert.equal(fenetre?.fin.toISOString().slice(0, 10), "2026-10-09", "4 semaines = 28 jours après le 11/09, pas 4 jours (15/09)");
});

test("l'unité fonctionne quelle que soit la casse : SEMAINE, Semaine, semaine, mois, Mois, jour", () => {
  const datePrimo = new Date("2026-09-11T12:00:00Z");
  for (const unite of ["SEMAINE", "Semaine", "semaine"]) {
    const fenetre = calculerFenetreEtape({ etape: etapeRappel(unite), dateNaissance: new Date("2026-01-01T12:00:00Z"), dateEtapePrecedente: datePrimo });
    assert.equal(fenetre?.fin.toISOString().slice(0, 10), "2026-10-09", `unite="${unite}"`);
  }
  for (const unite of ["MOIS", "Mois", "mois"]) {
    const fenetre = calculerFenetreEtape({ etape: etapeRappel(unite, 1), dateNaissance: new Date("2026-01-01T12:00:00Z"), dateEtapePrecedente: datePrimo });
    assert.equal(fenetre?.fin.toISOString().slice(0, 10), "2026-10-11", `unite="${unite}" (1 mois = 30 jours)`);
  }
  for (const unite of ["JOUR", "jour"]) {
    const fenetre = calculerFenetreEtape({ etape: etapeRappel(unite, 28), dateNaissance: new Date("2026-01-01T12:00:00Z"), dateEtapePrecedente: datePrimo });
    assert.equal(fenetre?.fin.toISOString().slice(0, 10), "2026-10-09", `unite="${unite}"`);
  }
});
