import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("l'écran Vaccins ouvre sur le tableau par animal et garde la préparation accessible", () => {
  const page = read("app/sanitaire/vaccins/page.tsx");
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const card = read("app/sanitaire/vaccins/PreparationVaccinCard.tsx");
  assert.match(page, /<TableauVaccinal/);
  assert.match(page, /Tableau vaccinal/);
  assert.match(tableau, /Vaccins affichés/);
  assert.match(tableau, /À faire/);
  assert.match(tableau, /Faits/);
  assert.match(page, /Préparer une séance de vaccination/);
  assert.match(page, /Modifier les protocoles/);
  assert.match(page, /Stock \/ flacons/);
  assert.match(card, /Préparer \/ imprimer/);
  assert.match(card, /<details ref={detailsRef} className="group">/);
  assert.match(card, /Voir les animaux/);
  assert.match(card, /Faire la séance/);
  assert.match(card, /Besoin maintenant/);
  assert.match(page, /Achat conseillé/);
  assert.match(card, /Reliquat utilisable/);
});

test("le tableau vaccinal propose un tri cyclique et des colonnes masquables sans barre supplémentaire", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /Recherche animal/);
  assert.match(tableau, /Vaccins affichés ▾/);
  assert.match(tableau, /Statuts ▾/);
  assert.doesNotMatch(tableau, /Nouvelle séance/);
  assert.match(tableau, /Saisie des vaccinations/);
  assert.match(tableau, /Tout sélectionner/);
  assert.match(tableau, /Tout désélectionner/);
  // Le clic d'en-tête fait ascendant, descendant, puis revient à l'ordre initial.
  assert.match(tableau, /function basculerTri/);
  assert.match(tableau, /setDirectionTri\("asc"\)/);
  assert.match(tableau, /setDirectionTri\("desc"\)/);
  assert.match(tableau, /setTri\(null\)/);
  assert.match(tableau, /directionTri === "asc" \? "↑" : "↓"/);
  assert.doesNotMatch(tableau, /Croissant|Décroissant/);
  assert.match(tableau, /ageJours = \(danaisIso: string\)/);
  assert.match(tableau, /onContextMenu/);
  assert.match(tableau, /Masquer cette colonne/);
  assert.match(tableau, /Réafficher une colonne/);
  assert.match(tableau, /Réafficher toutes les colonnes/);
  assert.doesNotMatch(tableau, /Colonnes affichées/);
  assert.match(tableau, /En retard/);
  // Cellules compactes : vraie coche + date secondaire, sans symbole décoratif.
  assert.match(tableau, /text-xl font-black leading-none/);
  assert.match(tableau, /text-base leading-none">☑/);
  assert.doesNotMatch(tableau, /◷|cellule\.statut === "EN_RETARD" \? "! "/);
  assert.doesNotMatch(tableau, /Fait le/);
  // L'ambiguïté historique est discrète, pas présentée comme une action vaccinale normale.
  assert.match(tableau, /Historique à rattacher/);
  assert.doesNotMatch(tableau, /Étape à valider/);
});

test("la deuxième passe ajoute gestation, vêlage et tri d'urgence sans règle vaccinale codée dans l'UI", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const grille = read("lib/vaccine-grid.ts");
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.doesNotMatch(tableau, /Filtrer la gestation/);
  assert.match(tableau, /enteteTriable\("Avant vêlage"/);
  assert.match(tableau, /formatTempsAvantVelage\(ligne\.dateVelagePrevueIso\)/);
  assert.match(tableau, /comparerUrgenceVaccinale/);
  assert.match(tableau, /`vaccin:\$\{etape\.id\}`/);
  assert.doesNotMatch(tableau, /"bg-green-600" : "bg-red-600"/);
  assert.match(grille, /dateVelagePrevueIso: animal\.dateVelagePrevueIso/);
  assert.match(page, /etat: \{ in: \["VERT", "ROSE"\] \}/);
  assert.doesNotMatch(tableau, /CRYPTIUM.*(21|90)|ROTAVEC.*(21|90)/i);
});

test("la sélection animale et l'impression reprennent exactement la vue courante", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /animauxSelectionnes/);
  assert.match(tableau, /Sélectionner ou désélectionner les animaux visibles/);
  assert.match(tableau, /actionsSelectionAnimaux\(uniquementSelection\)/);
  assert.match(tableau, /window\.print\(\)/);
  assert.match(tableau, /@page \{ size: A4 landscape/);
  assert.match(tableau, /thead \{ display: table-header-group/);
  assert.match(tableau, /break-inside: avoid/);
  assert.match(tableau, /animal-selection-column/);
});

test("les protocoles s'ouvrent avec un retour explicite au tableau vaccinal", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const page = read("app/sanitaire/vaccins/page.tsx");
  assert.match(tableau, /\/config\/protocoles\?returnTo=%2Fsanitaire%2Fvaccins/);
  assert.match(tableau, /Configurer les protocoles/);
  assert.match(page, /\/config\/protocoles\?returnTo=%2Fsanitaire%2Fvaccins/);
});

test("les couleurs différencient nettement à faire, bientôt et retard", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /border-yellow-700 bg-yellow-300/);
  assert.match(tableau, /border-orange-700 bg-orange-300/);
  assert.match(tableau, /border-red-800 bg-red-300/);
  assert.match(tableau, /statut === "A_FAIRE" \|\| statut === "BIENTOT"/);
});

test("le tableau réutilise les exécutants sanitaires et présente des âges terrain lisibles", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const selecteur = read("app/sanitaire/nouvel-evenement/ExecutantSelect.tsx");
  assert.match(tableau, /fetch\("\/api\/intervenants"\)/);
  assert.match(tableau, /<ExecutantSelect/);
  assert.match(tableau, /value=\{executant\}/);
  assert.match(selecteur, /fetch\("\/api\/intervenants"/);
  assert.match(tableau, /formatAgeTerrain\(ligne\.danaisIso\)/);
  assert.doesNotMatch(tableau, /\{ageJours\(ligne\.danaisIso\)\}j/);
});

test("les menus details CESAM se ferment hors menu, entre eux et avec Échap", () => {
  const gestion = read("components/GlobalDropdownDismissal.tsx");
  const layout = read("app/layout.tsx");
  assert.match(layout, /<GlobalDropdownDismissal \/>/);
  assert.match(gestion, /document\.addEventListener\("pointerdown"/);
  assert.match(gestion, /document\.addEventListener\("toggle"/);
  assert.match(gestion, /event\.key !== "Escape"/);
  assert.match(gestion, /details\[open\]/);
});

test("les cellules alimentent une séance puis réutilisent la route sanitaire existante", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const grille = read("lib/vaccine-grid.ts");
  const route = read("app/api/evenements/batch/route.ts");
  assert.match(tableau, /async function validerSession/);
  assert.match(tableau, /fetch\("\/api\/evenements\/batch"/);
  assert.match(tableau, /vaccinationSession:/);
  assert.match(tableau, /traitements:/);
  assert.match(tableau, /regrouperActesVaccinaux\([\s\S]*actes/);
  assert.match(tableau, /groupe\.actes\.map\(\(acte\) => acte\.ligne\.animalId\)/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /tx\.evenementSanitaire\.create/);
  assert.match(route, /tx\.traitement\.create/);
  assert.match(route, /tx\.vaccination\.create/);
  assert.match(route, /etapeSansMedicament && medicamentLieAuProtocole/);
  assert.match(grille, /protocoleId: string \| null/);
  assert.match(grille, /medicamentId: string \| null/);
});

test("le filtre de statut est multi-sélection et Bientôt reste dans À faire", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /Set<Statut>/);
  assert.match(tableau, /statut === "A_FAIRE" \|\| statut === "BIENTOT"/);
  assert.match(tableau, /filtres\.has\("aFaire"\) && estAFaire\(statut\)/);
  assert.doesNotMatch(tableau, /\['bientot', 'Bientôt'\]/);
  assert.match(tableau, /Orange = bientôt, inclus dans « À faire »/);
});

test("la saisie directe conserve la sélection et n'écrit qu'à la validation finale", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /useState<Set<string>>\(new Set\(\)\)/);
  assert.doesNotMatch(tableau, /Sélectionner à faire/);
  assert.match(tableau, /libelleVoieDose\(etape\.voie, etape\.dose, etape\.uniteDosage\)/);
  assert.match(tableau, /Vider la sélection/);
  assert.match(tableau, /Enregistrer \$\{actes\.length\} vaccination\(s\)/);
  assert.doesNotMatch(tableau, /Vérifier la séance/);
  assert.match(tableau, /Information nécessaire/);
  assert.match(tableau, /médicamentId|medicamentId/i);
  assert.match(tableau, /etapeProtocoleId: groupe\.etape\.id/);
  assert.match(tableau, /gestationId: acte\.ligne\.gestationId/);
  assert.match(tableau, /router\.refresh\(\)/);
});

test("la grille vaccinale regroupe les vaccins par bloc avec une sous-colonne par étape réelle", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const page = read("app/sanitaire/vaccins/page.tsx");
  const grille = read("lib/vaccine-grid.ts");
  // En-tête à deux niveaux : bloc (colSpan) puis sous-colonnes d'étapes.
  assert.match(tableau, /colSpan=\{bloc\.sousColonnes\.length\}/);
  assert.match(tableau, /blocsAffiches\.flatMap\(\(bloc\) => bloc\.sousColonnes\.map/);
  // Les premières colonnes restent fixes tant qu'elles sont visibles.
  assert.match(tableau, /animal-fixed/);
  assert.match(tableau, /decalageColonne/);
  // La même grille défilante reste disponible sur mobile, sans seconde interface divergente.
  assert.match(tableau, /vaccin-table-scroll overflow-auto/);
  // La page fournit les étapes réelles du protocole à la grille, sans en inventer.
  assert.match(page, /construireGrilleVaccinale/);
  assert.match(page, /prisma\.protocoleVaccin\.findMany/);
  assert.match(grille, /sousColonnes: \[\.\.\.protocole\.etapes\]/);
  assert.match(grille, /id: vaccin\.medicamentId,[\s\S]*label: "",[\s\S]*protocoleId: null/);
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
  assert.match(route, /gestationId: gestationIdAEnregistrer\(vaccinationConfig\.etapes, animal\.gestationId\)/);
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

test("la troisième passe compacte les commandes et fige les volets du tableau", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /<Settings size=\{18\}/);
  assert.match(tableau, /Configurer les protocoles/);
  assert.match(tableau, />Pharmacie</);
  assert.match(tableau, /Imprimer cette vue/);
  assert.match(tableau, /vaccin-head-1/);
  assert.match(tableau, /vaccin-head-2/);
  assert.match(tableau, /sticky top-8/);
  assert.match(tableau, /position: sticky/);
  assert.match(tableau, /overflow-auto/);
  assert.match(tableau, /-webkit-overflow-scrolling: touch/);
});

test("la grille est directement saisissable, y compris hors échéance ou hors protocole", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const grille = read("lib/vaccine-grid.ts");
  assert.match(tableau, /!cellule\.aValider && etape\.medicamentId/);
  assert.match(tableau, /rattachementProtocoleAutorise \? "structure" : "libre"/);
  assert.match(tableau, /groupe\.actes\.every/);
  assert.match(tableau, /\? \{ vaccinationSession:/);
  assert.match(grille, /rattachementProtocoleAutorise: eligible/);
  assert.match(grille, /protocoleId: null/);
});

test("l'historique ambigu est discret et se rattache sans jamais créer de second acte", () => {
  const tableau = read("app/sanitaire/vaccins/TableauVaccinal.tsx");
  const route = read("app/api/vaccinations/[id]/rattachement/route.ts");
  assert.match(tableau, /title="Historique à rattacher"/);
  assert.match(tableau, /rattachement-vaccinal/);
  assert.match(tableau, /Aucune étape compatible avec ce médicament dans ce protocole/);
  assert.match(tableau, /Choisir l’étape/);
  assert.match(tableau, /Historique — \$\{nomVaccin\}/);
  assert.match(tableau, /actesDuVaccin\(ligne\.actes, \{ id: medicamentId, nom: nomVaccin \}\)/);
  const routeTraitement = read("app/api/traitements/[id]/rattachement-vaccinal/route.ts");
  assert.match(routeTraitement, /prisma\.traitement\.update/);
  assert.doesNotMatch(routeTraitement, /vaccination\.create|traitement\.create/);
  assert.match(route, /prisma\.vaccination\.update/);
  assert.doesNotMatch(route, /vaccination\.create|traitement\.create/);
});
