import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resumeCibleQuestionnaire, sexeImplicite, texteFenetreAvantVelage } from "./vaccine-questionnaire-presentation.ts";

test("le résumé des catégories utilise le français naturel sans codes internes", () => {
  assert.equal(resumeCibleQuestionnaire(false, ["GENISSE"]), "Ce protocole sera proposé aux génisses.");
  assert.equal(resumeCibleQuestionnaire(false, ["GENISSE", "VACHE"]), "Ce protocole sera proposé aux génisses et aux vaches.");
  assert.equal(resumeCibleQuestionnaire(false, ["VEAU", "GENISSE", "VACHE"]), "Ce protocole sera proposé aux veaux, aux génisses et aux vaches.");
  assert.equal(resumeCibleQuestionnaire(true, []), "Ce protocole pourra concerner tous les bovins.");
  assert.doesNotMatch(resumeCibleQuestionnaire(false, ["GENISSE", "VACHE"]), /GENISSE|VACHE/);
  assert.equal(resumeCibleQuestionnaire(false, ["VELLE", "GENISSE", "VACHE"]),
    "Ce protocole sera proposé aux velles, aux génisses et aux vaches.");
  assert.equal(resumeCibleQuestionnaire(false, ["VEAU_M", "PETITE_GENISSE"]),
    "Ce protocole sera proposé aux veaux mâles et aux petites génisses.");
});

test("le sexe est implicite seulement lorsque les catégories le déterminent", () => {
  assert.equal(sexeImplicite(["GENISSE", "VACHE"]), "F");
  assert.equal(sexeImplicite(["TAUREAU"]), "M");
  assert.equal(sexeImplicite(["VEAU"]), null);
  assert.equal(sexeImplicite(["GENISSE", "TAUREAU"]), null);
  assert.equal(sexeImplicite(["VELLE", "PRESELECTION_GENISSE", "VACHE"]), "F");
  assert.equal(sexeImplicite(["VEAU_M"]), "M");
});

test("la fenêtre avant vêlage est formulée naturellement avec ses vraies bornes", () => {
  assert.equal(texteFenetreAvantVelage({ type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } }), "entre 3 mois et 3 semaines avant le vêlage");
});

test("le questionnaire masque le sexe redondant et reprend les règles réelles dans ses résumés", () => {
  const source = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(source, /\{afficherSexe && <label/);
  assert.match(source, /Le Rappel doit lui aussi être réalisé \{texteFenetreAvantVelage\(form\.calendrier\)\}/);
  assert.match(source, /À chaque prochaine gestation/);
  assert.match(source, /<b>Primo<\/b> — \{administration\(form\.preconPrimo\)\}/);
  assert.match(source, /<b>Rappel<\/b> — \{administration\(form\.preconRappel\)\}, \{texteDureeQuestionnaire\(form\.delai\)\} après la Primo/);
  assert.match(source, /\{fenetreInitiale\}/);
});
