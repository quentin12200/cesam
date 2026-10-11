import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planifierExtractionVaccin, type EtapeExtractionVaccin } from "./vaccine-protocol-extraction.ts";
import { statutDepuisEtapesFaites } from "./vaccine-statut.ts";

const CIBLE = "med-cible";
const AUTRE = "med-autre";
const idsCibles = { dose: null, primo: "nouvelle-primo", rappel: "nouveau-rappel", entretien: "nouvel-entretien" };
const etapes: EtapeExtractionVaccin[] = [
  { id: "ancienne-primo", label: "Primo", cycle: "INITIAL", medicamentIds: [CIBLE, AUTRE] },
  { id: "ancien-rappel", label: "Rappel", cycle: "INITIAL", medicamentIds: [CIBLE, AUTRE] },
  { id: "ancien-entretien", label: "Rappel annuel", cycle: "ENTRETIEN", medicamentIds: [CIBLE, AUTRE] },
  { id: "cible-seule", label: "Injection historique", cycle: "INITIAL", medicamentIds: [CIBLE] },
];

test("Vaccination et Traitement du vaccin extrait sont conservés 1:1, les autres restent dans le legacy", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [
      { id: "v-cible", animalId: "a1", medicamentId: CIBLE, etapeId: "ancienne-primo" },
      { id: "v-autre", animalId: "a2", medicamentId: AUTRE, etapeId: "ancienne-primo" },
    ],
    traitements: [
      { id: "t-cible", animalId: "a1", medicamentId: CIBLE, etapeId: "ancien-rappel" },
      { id: "t-autre", animalId: "a2", medicamentId: AUTRE, etapeId: "ancien-rappel" },
    ],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, [{ id: "v-cible", animalId: "a1", etapeCibleId: "nouvelle-primo" }]);
  assert.deepEqual(plan.traitements, [{ id: "t-cible", animalId: "a1", etapeCibleId: "nouveau-rappel" }]);
  assert.equal(plan.vaccinations.some((acte) => acte.id === "v-autre"), false);
  assert.equal(plan.traitements.some((acte) => acte.id === "t-autre"), false);
});

test("un acte sans medicamentId est attribuable quand son étape ne possède qu'un vaccin", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v1", animalId: "a1", medicamentId: null, etapeId: "cible-seule" }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (plan.possible) assert.deepEqual(plan.vaccinations, [{ id: "v1", animalId: "a1", etapeCibleId: null }]);
});

test("un médicament ambigu bloque toute extraction au lieu d'être deviné", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-ambigu", animalId: "a1", medicamentId: null, etapeId: "ancienne-primo" }],
    traitements: [],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.deepEqual(plan.actesAmbigus, [{ source: "VACCINATION", id: "v-ambigu" }]);
    assert.match(plan.raison, /sans médicament certain/);
  }
});

test("un rôle incertain conserve l'acte certain dans le nouveau protocole sans inventer d'étape", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v1", animalId: "a1", medicamentId: CIBLE, etapeId: "cible-seule" }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (plan.possible) assert.equal(plan.vaccinations[0].etapeCibleId, null);
});

test("un entretien historique extrait prouve PROTOCOLE_ACQUIS", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v1", animalId: "paluche", medicamentId: CIBLE, etapeId: "ancien-entretien" }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  const etapesNouvelles = [
    { id: "nouvelle-primo", cycle: "INITIAL", obligatoire: true },
    { id: "nouveau-rappel", cycle: "INITIAL", obligatoire: true },
    { id: "nouvel-entretien", cycle: "ENTRETIEN", obligatoire: true },
  ];
  assert.equal(statutDepuisEtapesFaites(etapesNouvelles, new Set(plan.vaccinations.map((acte) => acte.etapeCibleId!).filter(Boolean))), "PROTOCOLE_ACQUIS");
});

test("l'API propose une extraction confirmée, atomique, sans suffixe de protocole vaccin", () => {
  const route = readFileSync(new URL("../app/api/protocoles/route.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(route, /code: "PROTOCOLE_EXTRACTION_PROPOSEE"/);
  assert.match(route, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(route, /tx\.vaccination\.update/);
  assert.match(route, /tx\.traitement\.update/);
  assert.match(route, /tx\.statutProtocoleVaccinal\.deleteMany/);
  assert.match(route, /statutDepuisEtapesFaites/);
  assert.match(route, /medicamentIds\.size > 1[\s\S]*medicamentIds\.has\(configuration!\.medicamentId\)/);
  assert.doesNotMatch(route, /BOVILIS_CRYPTIUM_2|nomInterne.*_[23]/);
  assert.doesNotMatch(route, /CRYPTIUM|ROTAVEC/);
  assert.match(ui, /Séparer \{conflitProtocole\.extraction\.medicamentNom\} de l’ancien protocole et créer ce protocole/);
  assert.match(ui, /window\.confirm/);
});
