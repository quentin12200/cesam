import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unifierActesVaccinaux, type ActeVaccination } from "./vaccine-acts.ts";
import { resoudreAdministrationEtape, voiesPossibles, type PreconisationAdministration } from "./vaccine-administration.ts";
import { construireGrilleVaccinale, extraireActionsPrevues, type AnimalGrille, type EtapeGrille, type ProtocoleGrille } from "./vaccine-grid.ts";
import { actesDuVaccin, type ActeHistorique } from "./vaccine-history-view.ts";
import { calculerActionVaccinale } from "./vaccine-planner.ts";
import { actionsSelectionAnimaux, basculerSelectionVisibles, etatSelectionMaitre, libelleAnimauxSelectionnes } from "./vaccine-selection.ts";
import { construireChargeSoin } from "./vaccine-soin-seance.ts";
import { libelleVoieDose } from "./vaccine-table-presentation.ts";

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const jour = (iso: string) => new Date(`${iso}T12:00:00Z`);
const NAISSANCE = new Date("2024-03-01T12:00:00Z");

const etape = (id: string, label: string, ordre: number, extra: Partial<EtapeGrille> = {}, medicamentIds: string[] = ["med-crypt"]): EtapeGrille => ({
  id, label, ordre, cycle: "INITIAL", reference: ordre === 0 ? "NAISSANCE" : "ETAPE_PRECEDENTE",
  debutValeur: ordre === 0 ? 14 : 28, debutUnite: "JOUR", debutPosition: "APRES", finValeur: ordre === 0 ? 900 : 35, finUnite: "JOUR", finPosition: "APRES",
  medicamentId: medicamentIds[0], medicamentNom: medicamentIds[0] === "med-crypt" ? "BOVILIS CRYPTIUM" : "ROTAVEC CORONA",
  medicaments: medicamentIds.map((id) => ({ medicament: { id, nom: id === "med-crypt" ? "BOVILIS CRYPTIUM" : "ROTAVEC CORONA" } })),
  ...extra,
});

const protocole = (etapes: EtapeGrille[]): ProtocoleGrille => ({
  id: "proto", nom: "PREVELAGE", label: "Pré-vêlage", ageMinJours: 0, ageMaxJours: null,
  categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null, etapes,
});

const animal = (actes: ActeVaccination[], extra: Partial<AnimalGrille> = {}): AnimalGrille => ({
  id: "a1", nutrav: "7483", nom: "BRIGITTE", sexe: "F", danaisIso: NAISSANCE.toISOString(),
  categorie: "VACHE", nombreVelages: 1, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes, ...extra,
});

const acte = (id: string, date: string, medicamentId: string, vaccin: string, etapeId: string | null, extra: Partial<ActeVaccination> = {}): ActeVaccination => ({
  sourceType: "VACCINATION", sourceId: id, date: jour(date), vaccin, medicamentId,
  protocoleId: etapeId ? "proto" : null, etapeProtocoleId: etapeId, gestationId: null, statut: "FAIT", ...extra,
});

const enHistorique = (valeur: { sourceType: string; sourceId: string | null; date: Date; vaccin: string; medicamentId: string | null; protocoleId: string | null; etapeProtocoleId: string | null }): ActeHistorique => ({
  sourceType: valeur.sourceType as ActeHistorique["sourceType"], sourceId: valeur.sourceId, date: valeur.date.toISOString(), vaccin: valeur.vaccin,
  medicamentId: valeur.medicamentId, protocoleId: valeur.protocoleId, etapeProtocoleId: valeur.etapeProtocoleId,
  gestationId: null, voie: null, dose: null, uniteDosage: null,
});

test("A. historique multi-médicaments : Cryptium et Rotavec d'un même protocole, même jour, restent séparés", () => {
  const actes = unifierActesVaccinaux([
    acte("v-rota", "2026-10-01", "med-rota", "ROTAVEC CORONA", "pre", { voie: "IM", dose: 2 }),
    acte("v-crypt", "2026-10-01", "med-crypt", "BOVILIS CRYPTIUM", "pre", { voie: "SC", dose: 2 }),
    acte("v-ancien", "2025-09-01", "med-rota", "ROTAVEC CORONA", null),
    acte("v-nom", "2025-10-01", null as unknown as string, "Bovilis Cryptium", null),
  ], []);
  const { lignes } = construireGrilleVaccinale([animal(actes)], [protocole([etape("pre", "Pré-vêlage", 0, {}, ["med-crypt", "med-rota"])])], [], jour("2026-10-02"));
  const historique = lignes[0].actes.map(enHistorique);
  const crypt = actesDuVaccin(historique, { id: "med-crypt", nom: "BOVILIS CRYPTIUM" });
  const rota = actesDuVaccin(historique, { id: "med-rota", nom: "ROTAVEC CORONA" });
  assert.deepEqual(crypt.map((a) => a.sourceId), ["v-nom", "v-crypt"], "Cryptium : son acte du jour + l'ancien saisi sans medicamentId (même nom)");
  assert.deepEqual(rota.map((a) => a.sourceId), ["v-ancien", "v-rota"]);
  assert.ok(!crypt.some((a) => a.medicamentId === "med-rota"));
  assert.ok(!rota.some((a) => a.medicamentId === "med-crypt"));
});

test("B. voies possibles dérivées des préconisations validées, sans invention", () => {
  const preconisations = [
    { statut: "VALIDE", voie: "IM" }, { statut: "VALIDE", voie: "sous-cutanée" }, { statut: "VALIDE", voie: "IM" }, { statut: "A_VERIFIER", voie: "IN" },
  ];
  assert.deepEqual(voiesPossibles(preconisations, "IV"), ["IM", "SC"], "la voie usuelle legacy n'est qu'un repli");
  assert.deepEqual(voiesPossibles([{ statut: "A_VERIFIER", voie: "IN" }], "IV"), ["IV"]);
  assert.deepEqual(voiesPossibles([], null), []);
  // Fiche Pharmacie et protocole s'appuient sur la même dérivation.
  assert.match(lire("../app/pharmacie/[id]/MedicamentDetailClient.tsx"), /Voies possibles/);
  assert.match(lire("../app/pharmacie/[id]/MedicamentDetailClient.tsx"), /voiesPossibles\(preconisations, form\.voie\)/);
  const editeur = lire("../app/config/protocoles/ProtocoleEditor.tsx");
  assert.match(editeur, /voiesProposees\(med, m\.voie\)/);
  assert.doesNotMatch(editeur, /\{VOIES_ADMINISTRATION\.map\(\(v\) => <option key=\{v\.code\}>/, "le protocole ne propose plus toutes les voies du monde");
});

test("C. résolution dose/voie : liée > unique valide > liaison/legacy > rien d'inventé", () => {
  const im: PreconisationAdministration = { id: "p-im", statut: "VALIDE", voie: "IM", dose: 2, unite: "ml" };
  const sc: PreconisationAdministration = { id: "p-sc", statut: "VALIDE", voie: "SC", dose: 5, unite: "ml" };
  const brouillon: PreconisationAdministration = { id: "p-x", statut: "A_VERIFIER", voie: "IN", dose: 9, unite: "ml" };

  const liee = resoudreAdministrationEtape({ preconisations: [im, sc], preconisationLieeId: "p-sc", voieMedicament: "IM" });
  assert.deepEqual([liee.voie, liee.dose, liee.unite, liee.source], ["SC", 5, "ml", "PRECONISATION_LIEE"]);

  const unique = resoudreAdministrationEtape({ preconisations: [im, brouillon] });
  assert.deepEqual([unique.voie, unique.dose, unique.source], ["IM", 2, "PRECONISATION_UNIQUE"]);

  const ambigue = resoudreAdministrationEtape({ preconisations: [im, sc], voieMedicament: "IM" });
  assert.equal(ambigue.dose, null, "deux préconisations valides : aucune dose devinée");
  assert.equal(ambigue.ambigue, true);
  assert.equal(libelleVoieDose(ambigue.voie, ambigue.dose, ambigue.unite), "IM · dose ?");

  const parVoie = resoudreAdministrationEtape({ preconisations: [im, sc], voieLiaison: "SC" });
  assert.deepEqual([parVoie.voie, parVoie.dose], ["SC", 5], "la voie choisie sur la liaison départage les préconisations");

  const sansRien = resoudreAdministrationEtape({ preconisations: [] });
  assert.deepEqual([sansRien.voie, sansRien.dose], [null, null]);
  assert.equal(libelleVoieDose(sansRien.voie, sansRien.dose, sansRien.unite), "voie ? · dose ?");

  const legacy = resoudreAdministrationEtape({ preconisations: [], voieLiaison: null, voieMedicament: "SC" });
  assert.deepEqual([legacy.voie, legacy.dose, legacy.source], ["SC", null, "MEDICAMENT"]);

  // Plus de voie dans le gros en-tête du médicament : elle se lit sous chaque étape.
  assert.doesNotMatch(lire("../app/sanitaire/vaccins/TableauVaccinal.tsx"), /\{bloc\.nom\}\{bloc\.voie/);
});

test("D. nouvelle administration : l'ancien acte est conservé, le nouveau est un autre acte, les deux dates sont visibles", () => {
  const ancien = acte("v-ancien", "2026-02-10", "med-crypt", "BOVILIS CRYPTIUM", "primo");
  const nouveau = acte("v-nouveau", "2026-10-02", "med-crypt", "BOVILIS CRYPTIUM", "primo");
  const avant = construireGrilleVaccinale([animal([ancien])], [protocole([etape("primo", "Primo", 0)])], [], jour("2026-10-03")).lignes[0].cellules["primo"];
  assert.equal(avant.actes.length, 1);
  const apres = construireGrilleVaccinale([animal([ancien, nouveau])], [protocole([etape("primo", "Primo", 0)])], [], jour("2026-10-03")).lignes[0].cellules["primo"];
  assert.deepEqual(apres.actes.map((a) => a.sourceId), ["v-ancien", "v-nouveau"]);
  assert.deepEqual(apres.actes.map((a) => a.date.toISOString().slice(0, 10)), ["2026-02-10", "2026-10-02"]);

  const tableau = lire("../app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /Nouvelle administration/);
  assert.match(tableau, /ajouterNouvelleAdministration/);
  assert.match(tableau, /setActesSelectionnes\(\(actuels\) => new Set\(actuels\)\.add\(cleActe\(ligne\.animalId, etape\.id\)\)\)/);
  // L'enregistrement réutilise la route batch : elle crée toujours de NOUVEAUX actes.
  const batch = lire("../app/api/evenements/batch/route.ts");
  assert.match(batch, /tx\.vaccination\.create/);
  assert.doesNotMatch(batch, /tx\.vaccination\.update/);
});

test("E. étape basée sur le vêlage : suit le NOUVEAU vêlage, la récurrence en mois ne prend pas le dessus", () => {
  const velage = etape("annuel", "Pré-vêlage", 0, { cycle: "ENTRETIEN", reference: "VELAGE", debutValeur: 60, debutPosition: "AVANT", finValeur: 21, finPosition: "AVANT", recurrenceMois: 12 });
  const ancienne = acte("v1", "2026-09-10", "med-crypt", "BOVILIS CRYPTIUM", "annuel", { gestationId: "g1" });
  const cellule = (extra: Partial<AnimalGrille>) => construireGrilleVaccinale([animal([ancienne], extra)], [protocole([velage])], [], jour("2026-10-02")).lignes[0].cellules["annuel"];

  const nouvelle = cellule({ gestationId: "g2", dateVelagePrevueIso: jour("2027-02-15").toISOString() });
  assert.notEqual(nouvelle.statut, "FAIT", "l'acte de l'ancien cycle ne couvre pas le nouveau vêlage");
  assert.equal(nouvelle.fenetre?.debut.toISOString().slice(0, 10), "2026-12-17");
  assert.equal(nouvelle.fenetre?.fin.toISOString().slice(0, 10), "2027-01-25");
  assert.ok(!nouvelle.fenetre || nouvelle.fenetre.debut.getFullYear() === 2026, "pas septembre 2027");

  const memeCycle = cellule({ gestationId: "g1", dateVelagePrevueIso: jour("2027-02-15").toISOString() });
  assert.equal(memeCycle.statut, "FAIT");
  assert.equal(memeCycle.prochaine, null, "aucun +12 mois sur une étape VELAGE");

  const sansVelage = cellule({ gestationId: null, dateVelagePrevueIso: null });
  assert.notEqual(sansVelage.statut, "FAIT");
  assert.equal(sansVelage.date, null, "sans vêlage de référence : aucune échéance inventée");

  // Même règle dans le planner de préparation de séance.
  const base = { date: jour("2026-10-02"), dateNaissance: NAISSANCE, dateVelagePrevue: jour("2027-02-15"), statutProtocole: "PROTOCOLE_ACQUIS" as const, vaccinations: [{ date: jour("2026-09-10"), etapeProtocoleId: "annuel" }] };
  assert.equal(calculerActionVaccinale({ ...base, etapes: [velage] }).statut, "TERMINE");
  const parNaissance = calculerActionVaccinale({ ...base, etapes: [{ ...velage, reference: "NAISSANCE" }] });
  assert.equal(parNaissance.dateMin?.toISOString().slice(0, 10), "2027-09-10", "une étape non liée au vêlage garde sa récurrence");
});

test("F. sélection des animaux : case maître, indéterminé, Voir seulement / Afficher tous / Vider", () => {
  const visibles = ["a", "b", "c"];
  assert.equal(etatSelectionMaitre(visibles, new Set()), "AUCUN");
  assert.equal(etatSelectionMaitre(visibles, new Set(["a"])), "PARTIEL");
  assert.equal(etatSelectionMaitre(visibles, new Set(["a", "b", "c"])), "TOUS");
  assert.equal(etatSelectionMaitre(visibles, new Set(["zz"])), "AUCUN", "seuls les animaux visibles comptent");
  assert.deepEqual([...basculerSelectionVisibles(visibles, new Set())].sort(), ["a", "b", "c"]);
  assert.deepEqual([...basculerSelectionVisibles(visibles, new Set(["a"]))].sort(), ["a", "b", "c"], "partiel => tout sélectionner");
  assert.deepEqual([...basculerSelectionVisibles(visibles, new Set(["a", "b", "c", "zz"]))], ["zz"], "coché => désélectionne seulement les visibles");
  assert.equal(libelleAnimauxSelectionnes(8), "8 animaux sélectionnés");
  assert.equal(libelleAnimauxSelectionnes(1), "1 animal sélectionné");
  assert.deepEqual(actionsSelectionAnimaux(false), { basculerVue: "Voir seulement", vider: "Vider" });
  assert.deepEqual(actionsSelectionAnimaux(true), { basculerVue: "Afficher tous", vider: "Vider" });
  const tableau = lire("../app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /indeterminate = etatMaitre === "PARTIEL"/);
  assert.match(tableau, /basculerSelectionVisibles\(resultat\.map/);
  assert.doesNotMatch(tableau, /Tout sélectionner les animaux visibles|Afficher uniquement la sélection/);
});

test("G. soin ajouté à la séance : mêmes animaux/date/exécutant, Traitement normal, jamais un vaccin", () => {
  const charge = construireChargeSoin({
    animalIds: ["a1", "a2", "a2", "a3"], date: "2026-10-02", executant: "Céline", medicamentId: "med-bolus", medicamentNom: "BOLUS MINÉRAL",
    voie: "PO", dose: 1, uniteDosage: "bolus",
  });
  assert.deepEqual(charge.animalIds, ["a1", "a2", "a3"]);
  assert.equal(charge.date, "2026-10-02");
  assert.equal(charge.constatePar, "Céline");
  assert.equal(charge.traitements.length, 1);
  assert.deepEqual([charge.traitements[0].medicamentId, charge.traitements[0].executant, charge.traitements[0].dose], ["med-bolus", "Céline", 1]);
  assert.ok(!("vaccinationSession" in charge), "aucun contexte vaccinal : pas de Vaccination créée");
  assert.notEqual(charge.type, "Vaccination");

  const tableau = lire("../app/sanitaire/vaccins/TableauVaccinal.tsx");
  assert.match(tableau, /\+ Ajouter un soin \/ traitement/);
  assert.match(tableau, /Modifier les animaux/);
  assert.match(tableau, /Appliquer aux \$\{soinAnimaux\.size\} animaux/);
  assert.match(tableau, /fetch\("\/api\/evenements\/batch"/);
  assert.match(tableau, /medicament\.categorie !== "VACCIN"/);
  // Un soin n'entre jamais dans l'historique vaccinal : seuls les traitements de catégorie VACCIN y sont lus.
  assert.match(lire("../app/sanitaire/vaccins/page.tsx"), /traitements: \{ where: \{ medicament: \{ categorie: "VACCIN" \} \}/);
  const parasite = unifierActesVaccinaux([], []);
  assert.equal(parasite.length, 0);
});

test("10. actions prévues : base de données du futur bandeau, dérivée de la grille", () => {
  const rappel = etape("rappel", "Rappel", 1, { debutValeur: 28, finValeur: 35 });
  const grille = construireGrilleVaccinale([animal([acte("v1", "2026-10-01", "med-crypt", "BOVILIS CRYPTIUM", "primo")], { gestationId: "g", dateVelagePrevueIso: jour("2027-02-01").toISOString() })], [protocole([etape("primo", "Primo", 0), rappel])], [], jour("2026-10-30"));
  const actions = extraireActionsPrevues(grille);
  assert.equal(actions.length, 1);
  const [action] = actions;
  assert.deepEqual([action.animalId, action.medicamentId, action.protocoleId, action.etapeId, action.typeEtape, action.statut], ["a1", "med-crypt", "proto", "rappel", "INITIAL", "A_FAIRE"]);
  assert.equal(action.dateMin.toISOString().slice(0, 10), "2026-10-29");
  assert.equal(action.dateMax.toISOString().slice(0, 10), "2026-11-05");
  assert.equal(action.dateVelageReference, null, "étape non liée au vêlage");
  assert.equal(action.historique.length, 1);
  assert.ok("voie" in action && "dose" in action && "unite" in action);
});
