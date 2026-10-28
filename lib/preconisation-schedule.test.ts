import assert from "node:assert/strict";
import test from "node:test";
import { ecrireFrequence, erreurRythmePreconisation, formatDureePreconisation, formatFrequence, lireFrequence } from "./preconisation-schedule.ts";

test("une fréquence quotidienne et ses moments se retrouvent après enregistrement", () => {
  const enregistree = ecrireFrequence("JOUR", "2", "matin et soir");
  assert.equal(enregistree, "2 fois par jour (matin et soir)");
  assert.deepEqual(lireFrequence(enregistree), { mode: "JOUR", valeur: "2", moments: "matin et soir" });
  assert.equal(formatFrequence(enregistree), "2 fois par jour (matin et soir)");
  const recommandation = { frequence: enregistree, dureeValeur: "4", nombreAdministrations: "8" };
  assert.equal(erreurRythmePreconisation(recommandation), null);
  assert.equal(recommandation.nombreAdministrations, "8");
});

test("les fréquences historiques se lisent sans conversion des données", () => {
  assert.equal(formatFrequence("DOSE_UNIQUE"), "Dose unique");
  assert.equal(formatFrequence("Dose unique"), "Dose unique");
  assert.equal(formatFrequence("2_PAR_JOUR"), "2 fois par jour");
  assert.equal(formatFrequence("1_PAR_24H"), "Toutes les 24 h");
  assert.equal(formatFrequence("1_PAR_48H"), "Toutes les 48 h");
  assert.equal(formatFrequence("1_PAR_SEMAINE"), "Tous les 7 jours");
});

test("fréquences personnalisables au-delà des anciennes listes fixes", () => {
  for (const [mode, valeur] of [["JOUR", "4"], ["HEURE", "12"], ["INTERVALLE_JOURS", "3"]] as const) {
    assert.deepEqual(lireFrequence(ecrireFrequence(mode, valeur)), { mode, valeur, moments: "" });
  }
  assert.equal(formatFrequence(ecrireFrequence("HEURE", "12")), "Toutes les 12 h");
  assert.equal(formatFrequence(ecrireFrequence("INTERVALLE_JOURS", "3")), "Tous les 3 jours");
});

test("les consignes libres sont conservées exactement et une fréquence absente reste inconnue", () => {
  const libre = "Renouveler uniquement selon la consigne du vétérinaire";
  assert.equal(ecrireFrequence("AUTRE", lireFrequence(libre).valeur), libre);
  assert.equal(formatFrequence(libre), libre);
  assert.equal(formatFrequence(null), "Non renseignée");
  assert.equal(formatFrequence(""), "Non renseignée");
});

test("la durée conserve son unité en consultation", () => {
  assert.equal(formatDureePreconisation(4, "JOUR"), "4 jour(s)");
  assert.equal(formatDureePreconisation(12, "HEURE"), "12 heure(s)");
  assert.equal(formatDureePreconisation(2, "SEMAINE"), "2 semaine(s)");
  assert.equal(formatDureePreconisation(1, "MOIS"), "1 mois");
  assert.equal(formatDureePreconisation(2, "48H"), "2 période(s) de 48 h");
});

test("rejette nombres impossibles et garde les champs facultatifs", () => {
  for (const invalide of [0, -1, 1.5, "abc", true, Number.POSITIVE_INFINITY]) {
    assert.ok(erreurRythmePreconisation({ dureeValeur: invalide }));
    assert.ok(erreurRythmePreconisation({ nombreAdministrations: invalide }));
  }
  assert.ok(erreurRythmePreconisation({ frequence: "0_PAR_JOUR" }));
  assert.ok(erreurRythmePreconisation({ frequence: "1_PAR_0H" }));
  assert.ok(erreurRythmePreconisation({ frequence: 2 }));
  assert.equal(erreurRythmePreconisation({ frequence: "2_PAR_JOUR", dureeValeur: "4", nombreAdministrations: "" }), null);
  assert.equal(erreurRythmePreconisation({ statut: "VALIDE" }), null);
  assert.equal(erreurRythmePreconisation({ frequence: "DOSE_UNIQUE", dureeValeur: "", nombreAdministrations: "" }), null);
});
