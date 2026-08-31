import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("l'écran Vaccins ouvre sur la préparation et expose les trois espaces", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.match(page, />À préparer</);
  assert.match(page, />Protocoles</);
  assert.match(page, />Stock \/ flacons</);
  assert.match(page, /Préparer \/ imprimer/);
  assert.match(page, /<details className="group">/);
  assert.match(page, /Voir les animaux/);
  assert.match(page, /Faire la séance/);
  assert.match(page, /Besoin total/);
  assert.match(page, /Achat conseillé/);
  assert.match(page, /Reliquat utilisable/);
});

test("la feuille A4 est une lecture seule et contient les colonnes terrain", () => {
  const page = read("app/sanitaire/vaccins/impression/page.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(page, /size:A4 landscape/);
  assert.match(page, /Animal/);
  assert.match(page, /Injection/);
  assert.match(page, /Groupe \/ localisation/);
  assert.match(page, /Notes/);
  assert.doesNotMatch(loader, /\.create\(|\.update\(|\.delete\(/);
});

test("les statuts à confirmer sont sélectionnables et utilisent l'API existante", () => {
  const component = read("app/sanitaire/vaccins/StatutsAConfirmer.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(component, /Statut à confirmer/);
  assert.match(component, /Déjà primovaccinés/);
  assert.match(component, /Primo à faire/);
  assert.match(component, /Initialiser le protocole/);
  assert.match(component, /Quelle est la situation pour ce vaccin/);
  assert.match(component, /Choisissez un filtre ou recherchez un animal/);
  assert.match(component, /Tous les groupes/);
  assert.match(component, /Toutes les catégories/);
  assert.match(component, /Tous les âges/);
  assert.match(component, /LIMITE_AFFICHEE = 40/);
  assert.match(component, /api\/protocoles\/\$\{protocoleId\}\/statuts/);
  assert.match(loader, /statutsProtocolesVaccinaux/);
  assert.match(loader, /statutProtocole:/);
});

test("l'éditeur de protocole ne crée jamais de conditionnement commercial", () => {
  const editor = read("app/config/protocoles/ProtocoleEditor.tsx");
  const preparation = read("app/sanitaire/vaccins/page.tsx");
  const impression = read("app/sanitaire/vaccins/impression/page.tsx");
  assert.doesNotMatch(editor, /PACKS_DEFAUT/);
  assert.doesNotMatch(editor, /api\/medicaments\/.*\/conditionnements/);
  assert.doesNotMatch(editor, /1, 5, 10, 25, 50/);
  assert.match(editor, /Conditionnement à renseigner dans la Pharmacie/);
  assert.match(editor, /med\.conditionnements\.map/);
  assert.match(preparation, /Impossible de calculer — conditionnement non renseigné/);
  assert.match(impression, /Impossible de calculer — conditionnement non renseigné/);
  assert.match(read("lib/vaccine-preparation-data.ts"), /conditionnementRenseigne/);
});

test("le calendrier vaccinal utilise les étapes et jamais une fréquence générique", () => {
  const editor = read("app/config/protocoles/ProtocoleEditor.tsx");
  const planner = read("lib/vaccine-planner.ts");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(editor, /recurrenceMois/);
  assert.match(planner, /etape\.recurrenceMois/);
  assert.doesNotMatch(`${editor}\n${planner}\n${loader}`, /frequence|1 fois \/ Jour/i);
});

test("le détail d'un vaccin reste secondaire et limité aux trois groupes terrain", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.match(page, /statut: "A_FAIRE", titre: "À faire"/);
  assert.match(page, /statut: "A_PREVOIR", titre: "Bientôt"/);
  assert.match(page, /statut: "EN_RETARD", titre: "En retard"/);
  assert.match(page, /ligne\.dose.*ligne\.voie/);
  assert.doesNotMatch(page, /visibles\.map/);
});

test("le stock vaccinal présente seulement les données terrain utiles", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(page, /Stock Pharmacie/);
  assert.match(page, /Flacons ouverts/);
  assert.match(page, /Doses restantes/);
  assert.match(page, /Prochaine limite/);
  assert.match(page, /Besoin à venir/);
  assert.match(loader, /stockPharmacie/);
  assert.match(loader, /prochaineLimite/);
});

test("l'ancien onglet Vaccination sert à la saisie et à l'historique", () => {
  const sanitaire = read("app/sanitaire/SanitaireClient.tsx");
  assert.match(sanitaire, /Enregistrer une vaccination faite/);
  assert.match(sanitaire, /Ouvrir Vaccins · À préparer/);
  assert.match(sanitaire, /afficherAncienPilotageVaccinal = false/);
  assert.match(sanitaire, /<VaccinationFormWrapper \/>/);
  assert.match(sanitaire, /<RecentSection/);
});

test("les cartes Protocoles résument la règle, la dose et la voie", () => {
  const editor = read("app/config/protocoles/ProtocoleEditor.tsx");
  assert.match(editor, /resumeTypeProtocole/);
  assert.match(editor, /resumeRegleEtape/);
  assert.match(editor, /Dose \{dose\?\.dose/);
  assert.match(editor, /voie \{premiereLiaison/);
});
