import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("l'écran Vaccins ouvre sur la préparation et expose les trois espaces", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  const card = read("app/sanitaire/vaccins/PreparationVaccinCard.tsx");
  assert.match(page, />À préparer</);
  assert.match(page, />Protocoles</);
  assert.match(page, />Stock \/ flacons</);
  assert.match(card, /Préparer \/ imprimer/);
  assert.match(card, /<details ref={detailsRef} className="group">/);
  assert.match(card, /Voir les animaux/);
  assert.match(card, /Faire la séance/);
  assert.match(card, /Besoin maintenant/);
  assert.match(page, /Achat conseillé/);
  assert.match(card, /Reliquat utilisable/);
});

test("la feuille A4 est une lecture seule et contient les colonnes terrain", () => {
  const page = read("app/sanitaire/vaccins/impression/page.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(page, /size:A4 landscape/);
  assert.match(page, /Animal/);
  assert.match(page, /Injection/);
  assert.match(page, /Statut/);
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

test("le détail d'un vaccin affiche les cinq niveaux terrain", () => {
  const page = read("app/sanitaire/vaccins/PreparationVaccinCard.tsx");
  assert.match(page, /statut: "TROP_TOT", titre: "Trop tôt"/);
  assert.match(page, /statut: "A_PREVOIR", titre: "Dans ≤ 7 j"/);
  assert.match(page, /statut: "A_FAIRE", titre: "Dans la fenêtre"/);
  assert.match(page, /statut: "EN_RETARD_LEGER", titre: "Retard 1–3 j"/);
  assert.match(page, /statut: "EN_RETARD", titre: "Retard > 3 j"/);
  assert.match(page, /border-blue-500/);
  assert.match(page, /border-yellow-400/);
  assert.match(page, /border-green-500/);
  assert.match(page, /border-orange-500/);
  assert.match(page, /border-red-500/);
  assert.match(page, /ligne\.dose.*ligne\.voie/);
});

test("le stock vaccinal présente seulement les données terrain utiles", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  const loader = read("lib/vaccine-preparation-data.ts");
  assert.match(page, /Stock Pharmacie/);
  assert.match(page, /Flacons ouverts/);
  assert.match(page, /Doses restantes/);
  assert.match(page, /Prochaine limite/);
  assert.match(page, /Besoin maintenant/);
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
  assert.match(editor, /voie \{dose\?\.voie \|\| produit\?\.voie \|\| premiereLiaison\?\.voie/);
});

test("la séance terrain sélectionne exactement les animaux cochés", () => {
  const card = read("app/sanitaire/vaccins/PreparationVaccinCard.tsx");
  const form = read("app/sanitaire/nouvel-evenement/NouvelEvenementForm.tsx");
  assert.match(card, /useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(card, /Tout sélectionner à faire/);
  assert.match(card, /Tout désélectionner/);
  assert.match(card, /selection\.has\(ligne\.animalId\)/);
  assert.match(card, /animaux: nutravs\.join\(","\)/);
  assert.match(card, /if \(selection\.size === 0\)/);
  assert.match(card, /STATUTS_SELECTIONNABLES/);
  assert.match(form, /presetVaccination\.animaux\.filter/);
});

test("la validation sanitaire crée aussi les vaccinations liées", () => {
  const route = read("app/api/evenements/batch/route.ts");
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /tx\.vaccination\.create/);
  assert.match(route, /etapeProtocoleId: animal\.etapeProtocoleId/);
  assert.match(route, /gestationId: vaccinationConfig\.etapes\.find/);
  assert.match(route, /tx\.statutProtocoleVaccinal\.upsert/);
});

test("les veaux de moins de six mois exposent leur mère", () => {
  const loader = read("lib/vaccine-preparation-data.ts");
  const card = read("app/sanitaire/vaccins/PreparationVaccinCard.tsx");
  const print = read("app/sanitaire/vaccins/impression/page.tsx");
  assert.match(loader, /differenceInCalendarDays\(date, animal\.danais\) < 183/);
  assert.match(loader, /mereTravailManuel/);
  assert.match(card, /ligne\.mere/);
  assert.match(print, /ligne\.mere/);
});
