import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planifierExtractionVaccin, resoudreLegacyParMedicament, type EtapeExtractionVaccin } from "./vaccine-protocol-extraction.ts";
import { statutDepuisEtapesFaites } from "./vaccine-statut.ts";

const CIBLE = "med-cible";
const AUTRE = "med-autre";
const JOUR = new Date("2025-10-15T12:00:00Z");
const idsCibles = { dose: null, primo: "nouvelle-primo", rappel: "nouveau-rappel", entretien: "nouvel-entretien" };
const etapes: EtapeExtractionVaccin[] = [
  { id: "ancienne-primo", label: "Primo", cycle: "INITIAL", medicamentIds: [CIBLE, AUTRE] },
  { id: "ancien-rappel", label: "Rappel", cycle: "INITIAL", medicamentIds: [CIBLE, AUTRE] },
  { id: "ancien-entretien", label: "Rappel annuel", cycle: "ENTRETIEN", medicamentIds: [CIBLE, AUTRE] },
  { id: "cible-seule", label: "Injection historique", cycle: "INITIAL", medicamentIds: [CIBLE] },
];
const etapesNommees = etapes.map((etape) => ({
  ...etape,
  medicamentsConnus: etape.medicamentIds.map((medicamentId) => ({
    id: medicamentId,
    nom: medicamentId === CIBLE ? "BOVILIS CRYPTIUM" : "ROTAVEC CORONA",
  })),
}));

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
  assert.deepEqual(plan.traitementsDoublonsADetacher, []);
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

test("le nom historique CRYPTIUM classe l'acte comme AUTRE pendant l'extraction ROTAVEC", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: AUTRE, etapes: etapesNommees, idsCibles,
    vaccinations: [{ id: "v-cryptium", animalId: "a1", medicamentId: null, vaccin: "  bovilis, cryptiùm  ", etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (plan.possible) assert.deepEqual(plan.vaccinations, []);
});

test("le nom historique ROTAVEC classe l'acte comme CIBLE et prépare son medicamentId", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: AUTRE, etapes: etapesNommees, idsCibles,
    vaccinations: [{ id: "v-rotavec", animalId: "a1", medicamentId: null, vaccin: "ROTAVEC-CORONA", etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, [{
    id: "v-rotavec",
    animalId: "a1",
    etapeCibleId: "nouvelle-primo",
    medicamentIdAEnregistrer: AUTRE,
  }]);
});

test("deux noms historiques certains permettent les extractions successives sans troisième acte", () => {
  const vaccinations = [
    { id: "v-cryptium", animalId: "a1", medicamentId: null, vaccin: "BOVILIS CRYPTIUM", etapeId: "ancienne-primo", date: new Date("2025-10-10T12:00:00Z") },
    { id: "v-rotavec", animalId: "a1", medicamentId: null, vaccin: "ROTAVEC CORONA", etapeId: "ancienne-primo", date: new Date("2025-11-18T12:00:00Z") },
  ];
  const rotavec = planifierExtractionVaccin({ medicamentId: AUTRE, etapes: etapesNommees, idsCibles, vaccinations, traitements: [] });
  assert.equal(rotavec.possible, true);
  if (!rotavec.possible) return;
  const cryptium = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes: etapesNommees, idsCibles,
    vaccinations: vaccinations.filter((acte) => acte.id === "v-cryptium"),
    traitements: [],
  });
  assert.equal(cryptium.possible, true);
  if (!cryptium.possible) return;
  assert.deepEqual([...rotavec.vaccinations, ...cryptium.vaccinations].map((acte) => [acte.id, acte.medicamentIdAEnregistrer]), [
    ["v-rotavec", AUTRE],
    ["v-cryptium", CIBLE],
  ]);
});

test("un nom historique inconnu reste ambigu", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes: etapesNommees, idsCibles,
    vaccinations: [{ id: "v-inconnue", animalId: "a1", medicamentId: null, vaccin: "VACCIN INCONNU", etapeId: "ancienne-primo" }],
    traitements: [],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) assert.deepEqual(plan.actesAmbigus, [{ source: "VACCINATION", id: "v-inconnue" }]);
});

test("deux médicaments au même nom normalisé restent ambigus", () => {
  const etapeDoublon: EtapeExtractionVaccin = {
    id: "etape-doublon", label: "Injection", cycle: "INITIAL", medicamentIds: [CIBLE, AUTRE],
    medicamentsConnus: [{ id: CIBLE, nom: "Vaccin Démo" }, { id: AUTRE, nom: "VACCIN-DEMO" }],
  };
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes: [etapeDoublon], idsCibles,
    vaccinations: [{ id: "v-doublon", animalId: "a1", medicamentId: null, vaccin: "vaccin demo", etapeId: etapeDoublon.id }],
    traitements: [],
  });
  assert.equal(plan.possible, false);
});

test("un medicamentId existant reste prioritaire sur le texte vaccin", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes: etapesNommees, idsCibles,
    vaccinations: [{ id: "v-prioritaire", animalId: "a1", medicamentId: CIBLE, vaccin: "ROTAVEC CORONA", etapeId: "ancienne-primo" }],
    traitements: [],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, [{ id: "v-prioritaire", animalId: "a1", etapeCibleId: "nouvelle-primo" }]);
});

test("un médicament ambigu bloque toute extraction au lieu d'être deviné", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-ambigu", animalId: "a1", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.deepEqual(plan.actesAmbigus, [{ source: "VACCINATION", id: "v-ambigu" }]);
    assert.match(plan.raison, /restent réellement ambigus après vérification/);
    assert.deepEqual(plan.diagnostic, {
      totalAmbigus: 1,
      vaccinationsAmbigues: 1,
      autresActesAmbigus: 0,
      repartition: [{
        cause: "AUCUN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR",
        libelle: "aucun Traitement VACCIN certain le même animal/jour",
        nombre: 1,
        exemples: [{
          source: "VACCINATION",
          acteId: "v-ambigu",
          animalId: "a1",
          date: JOUR.toISOString(),
          vaccinationId: "v-ambigu",
          ancienneEtape: { id: "ancienne-primo", label: "Primo" },
          medicamentIdVaccination: null,
          medicamentsPossiblesEtape: [AUTRE, CIBLE].sort(),
          medicamentsReelsJour: [],
          nombreVaccinationsGeneriquesJour: 1,
        }],
      }],
    });
  }
});

test("un Traitement VACCIN identifié le même jour résout une Vaccination legacy sans médicament", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-legacy", animalId: "a1", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
    traitementsVaccinauxReels: [{ animalId: "a1", dateDebut: JOUR, medicamentId: CIBLE }],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, [{ id: "v-legacy", animalId: "a1", etapeCibleId: "nouvelle-primo" }]);
  assert.deepEqual(plan.traitements, [], "le Traitement de référence n'est pas ajouté une deuxième fois au plan");
  assert.deepEqual(plan.traitementsDoublonsADetacher, []);
  assert.equal(plan.resolusAutomatiquement, 1);
});

test("le médicament réel de l'autre vaccin classe l'acte AUTRE sans le déplacer", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-legacy-autre", animalId: "a2", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
    traitementsVaccinauxReels: [{ animalId: "a2", dateDebut: JOUR, medicamentId: AUTRE }],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, []);
  assert.equal(plan.resolusAutomatiquement, 1);
});

test("une Vaccination générique couverte par CRYPTIUM et ROTAVEC certains ne bloque pas l'extraction CRYPTIUM", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-generique", animalId: "a3", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [
      { id: "t-cryptium", animalId: "a3", medicamentId: CIBLE, etapeId: "ancienne-primo", date: JOUR },
      { id: "t-rotavec", animalId: "a3", medicamentId: AUTRE, etapeId: "ancienne-primo", date: JOUR },
    ],
    traitementsVaccinauxReels: [
      { animalId: "a3", dateDebut: JOUR, medicamentId: CIBLE },
      { animalId: "a3", dateDebut: JOUR, medicamentId: AUTRE },
    ],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, []);
  assert.deepEqual(plan.vaccinationsGeneriquesANeutraliser, ["v-generique"]);
  assert.deepEqual(plan.traitements.map((acte) => acte.id), ["t-cryptium"]);
  assert.equal(plan.resolusAutomatiquement, 1);
});

test("la même Vaccination générique couverte ne bloque pas l'extraction ROTAVEC", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: AUTRE, etapes, idsCibles,
    vaccinations: [{ id: "v-generique", animalId: "a3", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [
      { id: "t-cryptium", animalId: "a3", medicamentId: CIBLE, etapeId: "ancienne-primo", date: JOUR },
      { id: "t-rotavec", animalId: "a3", medicamentId: AUTRE, etapeId: "ancienne-primo", date: JOUR },
    ],
    traitementsVaccinauxReels: [
      { animalId: "a3", dateDebut: JOUR, medicamentId: CIBLE },
      { animalId: "a3", dateDebut: JOUR, medicamentId: AUTRE },
    ],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations, []);
  assert.deepEqual(plan.vaccinationsGeneriquesANeutraliser, ["v-generique"]);
  assert.deepEqual(plan.traitements.map((acte) => acte.id), ["t-rotavec"]);
});

test("séparation successive CRYPTIUM puis ROTAVEC conserve exactement deux vrais actes", () => {
  const traitements = [
    { id: "t-cryptium", animalId: "a3", medicamentId: CIBLE, etapeId: "ancienne-primo", date: JOUR },
    { id: "t-rotavec", animalId: "a3", medicamentId: AUTRE, etapeId: "ancienne-primo", date: JOUR },
  ];
  const reels = traitements.map((acte) => ({ animalId: acte.animalId, dateDebut: acte.date, medicamentId: acte.medicamentId }));
  const cryptium = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-generique", animalId: "a3", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements, traitementsVaccinauxReels: reels,
  });
  assert.equal(cryptium.possible, true);
  if (!cryptium.possible) return;
  const rotavec = planifierExtractionVaccin({
    medicamentId: AUTRE, etapes, idsCibles,
    vaccinations: [],
    traitements: traitements.filter((acte) => acte.id === "t-rotavec"),
    traitementsVaccinauxReels: reels,
  });
  assert.equal(rotavec.possible, true);
  if (!rotavec.possible) return;
  assert.deepEqual([
    ...cryptium.vaccinations, ...cryptium.traitements,
    ...rotavec.vaccinations, ...rotavec.traitements,
  ].map((acte) => acte.id).sort(), ["t-cryptium", "t-rotavec"]);
});

test("une couverture incomplète reste ambiguë", () => {
  const etapesTroisVaccins = etapes.map((etape) => etape.id === "ancienne-primo"
    ? { ...etape, medicamentIds: [CIBLE, AUTRE, "med-troisieme"] }
    : etape);
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes: etapesTroisVaccins, idsCibles,
    vaccinations: [{ id: "v-incomplete", animalId: "a8", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
    traitementsVaccinauxReels: [
      { animalId: "a8", dateDebut: JOUR, medicamentId: CIBLE },
      { animalId: "a8", dateDebut: JOUR, medicamentId: AUTRE },
    ],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.deepEqual(plan.actesAmbigus, [{ source: "VACCINATION", id: "v-incomplete" }]);
    assert.equal(plan.diagnostic.repartition[0]?.cause, "COUVERTURE_PARTIELLE_MEDICAMENTS_ETAPE");
    assert.deepEqual(plan.diagnostic.repartition[0]?.exemples[0]?.medicamentsReelsJour, [AUTRE, CIBLE].sort());
  }
});

test("plusieurs Vaccination génériques le même jour restent ambiguës", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [
      { id: "v-generique-1", animalId: "a9", medicamentId: null, etapeId: "ancienne-primo", date: JOUR },
      { id: "v-generique-2", animalId: "a9", medicamentId: null, etapeId: "ancienne-primo", date: JOUR },
    ],
    traitements: [],
    traitementsVaccinauxReels: [
      { animalId: "a9", dateDebut: JOUR, medicamentId: CIBLE },
      { animalId: "a9", dateDebut: JOUR, medicamentId: AUTRE },
    ],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.deepEqual(plan.actesAmbigus, [
      { source: "VACCINATION", id: "v-generique-1" },
      { source: "VACCINATION", id: "v-generique-2" },
    ]);
    assert.equal(plan.diagnostic.repartition[0]?.cause, "PLUSIEURS_VACCINATIONS_GENERIQUES_MEME_JOUR");
    assert.equal(plan.diagnostic.repartition[0]?.nombre, 2);
    assert.equal(plan.diagnostic.repartition[0]?.exemples[0]?.nombreVaccinationsGeneriquesJour, 2);
  }
});

test("le diagnostic distingue un ou plusieurs Traitement VACCIN certains mais incompatibles avec le legacy", () => {
  const creerPlan = (medicamentIds: string[]) => planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: `v-${medicamentIds.length}`, animalId: "a-diagnostic", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
    traitementsVaccinauxReels: medicamentIds.map((medicamentId) => ({ animalId: "a-diagnostic", dateDebut: JOUR, medicamentId })),
  });

  const un = creerPlan(["med-hors-legacy"]);
  assert.equal(un.possible, false);
  if (!un.possible) assert.equal(un.diagnostic.repartition[0]?.cause, "UN_TRAITEMENT_VACCIN_CERTAIN_MEME_JOUR");

  const plusieurs = creerPlan(["med-hors-legacy-1", "med-hors-legacy-2"]);
  assert.equal(plusieurs.possible, false);
  if (!plusieurs.possible) assert.equal(plusieurs.diagnostic.repartition[0]?.cause, "PLUSIEURS_TRAITEMENTS_VACCIN_CERTAINS_MEME_JOUR");
});

test("le diagnostic signale une étape legacy absente", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-sans-etape", animalId: "a-sans-etape", medicamentId: null, etapeId: "etape-supprimee", date: JOUR }],
    traitements: [],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.equal(plan.diagnostic.repartition[0]?.cause, "ETAPE_LEGACY_ABSENTE");
    assert.deepEqual(plan.diagnostic.repartition[0]?.exemples[0]?.ancienneEtape, { id: "etape-supprimee", label: null });
  }
});

test("le diagnostic limite chaque catégorie à cinq exemples sans fausser son total", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: Array.from({ length: 6 }, (_, index) => ({
      id: `v-exemple-${index}`,
      animalId: `a-exemple-${index}`,
      medicamentId: null,
      etapeId: "ancienne-primo",
      date: JOUR,
    })),
    traitements: [],
  });
  assert.equal(plan.possible, false);
  if (!plan.possible) {
    assert.equal(plan.diagnostic.totalAmbigus, 6);
    assert.equal(plan.diagnostic.repartition[0]?.nombre, 6);
    assert.equal(plan.diagnostic.repartition[0]?.exemples.length, 5);
  }
});

test("un Traitement VACCIN non rattaché au legacy sert de vérité sans créer de doublon", () => {
  const traitementSansProtocole = { animalId: "a4", dateDebut: JOUR, medicamentId: CIBLE, protocoleVaccinId: null };
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-technique", animalId: "a4", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [],
    traitementsVaccinauxReels: [traitementSansProtocole],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations.map((acte) => acte.id), ["v-technique"]);
  assert.deepEqual(plan.traitements, [], "la réconciliation n'ajoute pas le Traitement source au plan d'extraction");
  assert.deepEqual(plan.traitementsDoublonsADetacher, []);
});

test("un Traitement déjà rattaché et sa Vaccination legacy correspondante donnent un seul fait logique extrait", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [{ id: "v-structuree", animalId: "a7", medicamentId: null, etapeId: "ancienne-primo", date: JOUR }],
    traitements: [{ id: "t-double", animalId: "a7", medicamentId: CIBLE, etapeId: "ancienne-primo", date: JOUR }],
    traitementsVaccinauxReels: [{ animalId: "a7", dateDebut: JOUR, medicamentId: CIBLE }],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.deepEqual(plan.vaccinations.map((acte) => acte.id), ["v-structuree"]);
  assert.deepEqual(plan.traitements, []);
  assert.deepEqual(plan.traitementsDoublonsADetacher, ["t-double"]);
  assert.equal(plan.vaccinations.length + plan.traitements.length, 1);
});

test("scénario réconcilié : deux actes certains, aucun acte ambigu", () => {
  const plan = planifierExtractionVaccin({
    medicamentId: CIBLE, etapes, idsCibles,
    vaccinations: [
      { id: "v-cible-resolue", animalId: "a5", medicamentId: null, etapeId: "ancienne-primo", date: JOUR },
      { id: "v-autre-resolue", animalId: "a6", medicamentId: null, etapeId: "ancienne-primo", date: JOUR },
    ],
    traitements: [],
    traitementsVaccinauxReels: [
      { animalId: "a5", dateDebut: JOUR, medicamentId: CIBLE },
      { animalId: "a6", dateDebut: JOUR, medicamentId: AUTRE },
    ],
  });
  assert.equal(plan.possible, true);
  if (!plan.possible) return;
  assert.equal(plan.resolusAutomatiquement, 2);
  assert.deepEqual(plan.vaccinations.map((acte) => acte.id), ["v-cible-resolue"]);
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

test("après extraction de A, le legacy renommé restant est encore découvert pour B par medicamentId", () => {
  const legacyRenomme = { id: "legacy-a-b", nom: "PROTOCOLE_AB_LEGACY_LEGACYAB" };
  assert.deepEqual(resoudreLegacyParMedicament([legacyRenomme]), { type: "UNIQUE", protocole: legacyRenomme });
});

test("deux legacy contenant le même médicament bloquent tout choix automatique", () => {
  assert.deepEqual(resoudreLegacyParMedicament([{ id: "legacy-1" }, { id: "legacy-2" }]), {
    type: "AMBIGU",
    protocoleIds: ["legacy-1", "legacy-2"],
  });
});

test("l'API propose une extraction confirmée, atomique, sans suffixe de protocole vaccin", () => {
  const route = readFileSync(new URL("../app/api/protocoles/route.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/config/protocoles/ProtocoleQuestionnaire.tsx", import.meta.url), "utf8");
  assert.match(route, /code: "PROTOCOLE_EXTRACTION_PROPOSEE"/);
  assert.match(route, /const diagnostic = plan\.possible \? undefined :/,
    "le diagnostic n'est construit que lorsque l'extraction est impossible");
  assert.match(route, /animal: \{ select: \{ nutrav: true \} \}/,
    "l'API lit le numéro de travail sans modifier l'animal");
  assert.match(route, /nutrav: nutravParAnimalId\.get\(exemple\.animalId\) \?\? null/,
    "chaque exemple reçoit son numéro de travail lorsque celui-ci existe");
  assert.match(route, /await prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(route, /medicament: \{ categorie: "VACCIN" \}/);
  assert.match(route, /traitementsVaccinauxReelsActuels = [\s\S]*await tx\.traitement\.findMany/,
    "la confirmation recharge l'historique médicamenteux dans la transaction");
  assert.match(route, /traitementsVaccinauxReels: traitementsVaccinauxReelsActuels/,
    "la confirmation recalcule le même plan avec les données actuelles");
  assert.match(route, /tx\.vaccination\.update/);
  assert.match(route, /vaccin: true/,
    "l'API lit le nom historique réellement enregistré sur la Vaccination");
  assert.match(route, /medicamentId: acte\.medicamentIdAEnregistrer/,
    "le médicament identifié par nom est persisté uniquement lors du déplacement de l'acte");
  assert.match(route, /NEUTRALISE_DOUBLON_LEGACY/);
  assert.match(route, /vaccinationsGeneriquesANeutraliser/);
  assert.match(route, /tx\.traitement\.update/);
  assert.match(route, /tx\.traitement\.updateMany\([\s\S]*traitementsDoublons/);
  assert.match(route, /tx\.statutProtocoleVaccinal\.deleteMany/);
  assert.match(route, /statutDepuisEtapesFaites/);
  assert.match(route, /configurationQuestionnaireJson: null,[\s\S]*medicaments: \{ some: \{ medicamentId: configuration\.medicamentId \}/);
  assert.match(route, /configurationQuestionnaireJson: \{ not: null \}[\s\S]*Modifie ce protocole au lieu d’en créer un second/);
  assert.match(route, /resoudreLegacyParMedicament/);
  assert.match(route, /PROTOCOLES_LEGACY_AMBIGUS/);
  assert.doesNotMatch(route, /BOVILIS_CRYPTIUM_2|nomInterne.*_[23]/);
  assert.doesNotMatch(route, /CRYPTIUM|ROTAVEC/);
  const extraction = readFileSync(new URL("./vaccine-protocol-extraction.ts", import.meta.url), "utf8");
  assert.doesNotMatch(extraction, /CRYPTIUM|ROTAVEC/);
  assert.match(ui, /Confirmer la séparation de \{conflitProtocole\.extraction\.medicamentNom\}/);
  assert.match(ui, /Prévisualisation — aucun changement effectué/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /conflitProtocole\.extraction\.raison !== erreurEnregistrement/,
    "un même message d'ambiguïté n'est affiché qu'une fois");
  assert.match(ui, /diagnosticExtraction\.totalAmbigus/,
    "le questionnaire affiche le total d'actes ambigus renvoyé par l'API");
  assert.match(ui, /diagnosticExtraction\.repartition\.map\(\(categorie\) =>/,
    "le questionnaire affiche le nombre et le libellé de chaque catégorie");
  assert.match(ui, /categorie\.exemples\.slice\(0, 5\)\.map/,
    "l'interface limite chaque catégorie à cinq exemples");
  assert.match(ui, /exemple\.nutrav \|\| exemple\.animalId/,
    "le numéro de travail est prioritaire avec repli sur l'identifiant animal");
  assert.match(ui, /dateDiagnostic\(exemple\.date\)/);
  assert.match(ui, /exemple\.ancienneEtape\?\.label \|\| "Étape inconnue"/);
});
