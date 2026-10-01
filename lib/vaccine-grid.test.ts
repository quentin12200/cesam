import assert from "node:assert/strict";
import test from "node:test";
import { construireBlocsVaccinaux, construireGrilleVaccinale, type AnimalGrille, type ProtocoleGrille, type VaccinPharmacieGrille } from "./vaccine-grid.ts";

const AUJOURDHUI = new Date("2026-09-29T12:00:00Z");
const jours = (n: number) => new Date(new Date("2026-01-01T12:00:00Z").getTime() + n * 86_400_000);

const etapePrimo = {
  id: "bovigrip-primo", label: "Primo", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE",
  debutValeur: 14, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 45, finUnite: "JOUR", finPosition: "APRES",
  medicamentId: "med-bovigrip", medicamentNom: "BOVILIS BOVIGRIP",
  medicaments: [{ medicament: { id: "med-bovigrip", nom: "BOVILIS BOVIGRIP" } }],
};
const etapeRappel = {
  id: "bovigrip-rappel", label: "Rappel", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE",
  debutValeur: 28, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 35, finUnite: "JOUR", finPosition: "APRES",
  medicamentId: "med-bovigrip", medicamentNom: "BOVILIS BOVIGRIP",
  medicaments: [{ medicament: { id: "med-bovigrip", nom: "BOVILIS BOVIGRIP" } }],
};
const protocoleBovigrip: ProtocoleGrille = {
  id: "proto-bovigrip", nom: "BOVILIS_BOVIGRIP", label: "Bovigrip", ageMinJours: 0, ageMaxJours: null,
  categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null,
  etapes: [etapePrimo, etapeRappel],
};

function animal(partiel: Partial<AnimalGrille> = {}): AnimalGrille {
  return {
    id: "a1", nutrav: "7494", nom: "Bafouille", sexe: "F", danaisIso: jours(0).toISOString(),
    categorie: "VELLE", nombreVelages: 0, groupeNom: null, gestationId: null, dateVelagePrevueIso: null,
    actes: [], ...partiel,
  };
}

test("les sous-colonnes viennent des étapes réelles du protocole, rien n'est inventé", () => {
  const blocs = construireBlocsVaccinaux([protocoleBovigrip], []);
  assert.equal(blocs.length, 1);
  assert.deepEqual(blocs[0].sousColonnes.map((s) => s.label), ["Primo", "Rappel"]);
  assert.equal(blocs[0].sousColonnes[0].protocoleId, "proto-bovigrip");
  assert.equal(blocs[0].sousColonnes[0].medicamentId, "med-bovigrip");
});

test("un vaccin de pharmacie sans protocole garde une seule sous-colonne (pas d'étape inventée)", () => {
  const vaccin: VaccinPharmacieGrille = { medicamentId: "med-nasym", nom: "NASYM", voie: "IN" };
  const blocs = construireBlocsVaccinaux([], [vaccin]);
  assert.equal(blocs.length, 1);
  assert.equal(blocs[0].sousColonnes.length, 1);
  assert.equal(blocs[0].sousColonnes[0].label, "");
});

test("primo non fait et hors fenêtre => en retard (rouge) ; rappel non atteignable => vide", () => {
  const a = animal({ danaisIso: jours(-100).toISOString() }); // 100j : primo (14-45j) en retard
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  const cellules = lignes[0].cellules;
  assert.equal(cellules["bovigrip-primo"].statut, "EN_RETARD");
  assert.equal(cellules["bovigrip-rappel"].statut, "VIDE", "l'étape précédente n'étant pas faite, le rappel n'a pas de fenêtre calculable");
});

test("une échéance pas encore ouverte mais proche (A_PREVOIR du moteur) devient BIENTOT, distinct d'À faire", () => {
  // Fenêtre primo : 14-45j après naissance. Un veau de 10j est hors fenêtre mais proche
  // (bientôtJours=30 par défaut dans calculerActionVaccinale, le moteur de planification lui-même
  // n'est pas modifié : seule la présentation distingue désormais BIENTOT d'A_FAIRE).
  const a = animal({ danaisIso: new Date(AUJOURDHUI.getTime() - 10 * 86_400_000).toISOString() });
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  assert.equal(lignes[0].cellules["bovigrip-primo"].statut, "BIENTOT");
  assert.ok(lignes[0].cellules["bovigrip-primo"].date, "la date affichée est le début de la fenêtre à venir");
});

test("un Bovigrip saisi en simple Traitement (sans étape) est rattaché automatiquement au primo", () => {
  const datePrimo = jours(20); // dans la fenêtre 14-45j
  const a = animal({
    danaisIso: jours(0).toISOString(),
    actes: [{ date: datePrimo, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" }],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  const cellules = lignes[0].cellules;
  assert.equal(cellules["bovigrip-primo"].statut, "FAIT");
  assert.equal(cellules["bovigrip-primo"].date?.toISOString(), datePrimo.toISOString());
  assert.equal(cellules["bovigrip-primo"].aValider, false, "rattaché sans ambiguïté : pas d'avertissement");
});

test("le rappel calculé après un primo fait peut être à faire (orange) ou en retard (rouge)", () => {
  const datePrimo = jours(-40); // primo fait il y a 40 j (rappel : 28 à 35 j après => déjà dépassé)
  const a = animal({
    danaisIso: jours(-100).toISOString(),
    actes: [{ date: datePrimo, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: "proto-bovigrip", etapeProtocoleId: "bovigrip-primo", gestationId: null, statut: "FAIT" }],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  const cellules = lignes[0].cellules;
  assert.equal(cellules["bovigrip-primo"].statut, "FAIT");
  assert.equal(cellules["bovigrip-rappel"].statut, "EN_RETARD");
  assert.ok(cellules["bovigrip-rappel"].date, "la date affichée est l'échéance de la fenêtre");
});

test("deux injections non rattachables au même produit déclenchent ⚠ À vérifier sur la 1re sous-colonne, jamais sur une case déjà cochée", () => {
  const a = animal({
    danaisIso: jours(0).toISOString(),
    actes: [
      { date: jours(20), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
      { date: jours(50), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
    ],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  const primo = lignes[0].cellules["bovigrip-primo"];
  assert.notEqual(primo.statut, "FAIT", "ambiguïté : aucune des deux injections n'est affectée automatiquement");
  assert.equal(primo.aValider, true);
});

test("un animal non concerné (mauvais sexe) n'a jamais de recommandation inventée, mais une vaccination réellement faite reste visible", () => {
  // Règle absolue posée précédemment : une vaccination réellement enregistrée doit toujours
  // être visible comme faite, même si le protocole ne cible plus cet animal aujourd'hui
  // (ex : catégorie recalculée, changement de règle de ciblage...).
  const protocoleFemelles: ProtocoleGrille = { ...protocoleBovigrip, sexeCible: "F" };

  const sansActe = animal({ sexe: "M" });
  const { lignes: sansHistorique } = construireGrilleVaccinale([sansActe], [protocoleFemelles], [], AUJOURDHUI);
  assert.equal(sansHistorique[0].cellules["bovigrip-primo"].statut, "VIDE", "pas de recommandation inventée pour un animal non concerné");
  assert.equal(sansHistorique[0].cellules["bovigrip-rappel"].statut, "VIDE");

  const dateActe = jours(20);
  const avecActe = animal({ sexe: "M", actes: [{ date: dateActe, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: "proto-bovigrip", etapeProtocoleId: "bovigrip-primo", gestationId: null, statut: "FAIT" }] });
  const { lignes: avecHistorique } = construireGrilleVaccinale([avecActe], [protocoleFemelles], [], AUJOURDHUI);
  assert.equal(avecHistorique[0].cellules["bovigrip-primo"].statut, "FAIT", "un fait réel reste visible même si l'animal n'est plus éligible aujourd'hui");
  assert.equal(avecHistorique[0].cellules["bovigrip-primo"].date?.toISOString(), dateActe.toISOString());
  assert.equal(avecHistorique[0].cellules["bovigrip-rappel"].statut, "VIDE", "le rappel, lui, n'est pas inventé pour un animal non concerné");
});

test("rappel sans médicament lié en base (cas réel Bovigrip) : une seule injection orpheline est quand même rattachée au primo", () => {
  // rattacherPrimoNonLiee refuse de trancher si les deux étapes ne partagent pas le même
  // médicament (ids[1] vide ici) ; le repli à une seule candidate doit alors prendre le relais.
  const rappelSansMedicament = { ...etapeRappel, medicamentId: null, medicamentNom: null, medicaments: [] };
  const protocole: ProtocoleGrille = { ...protocoleBovigrip, etapes: [etapePrimo, rappelSansMedicament] };
  const dateActe = jours(20);
  const a = animal({
    actes: [{ date: dateActe, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" }],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocole], [], AUJOURDHUI);
  assert.equal(lignes[0].cellules["bovigrip-primo"].statut, "FAIT");
  assert.equal(lignes[0].cellules["bovigrip-primo"].date?.toISOString(), dateActe.toISOString());
  assert.equal(lignes[0].cellules["bovigrip-primo"].aValider, false);
});

test("rappel sans médicament lié : deux injections orphelines restent ambiguës (pas de rattachement à l'aveugle)", () => {
  const rappelSansMedicament = { ...etapeRappel, medicamentId: null, medicamentNom: null, medicaments: [] };
  const protocole: ProtocoleGrille = { ...protocoleBovigrip, etapes: [etapePrimo, rappelSansMedicament] };
  const a = animal({
    actes: [
      { date: jours(20), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
      { date: jours(50), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
    ],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocole], [], AUJOURDHUI);
  assert.notEqual(lignes[0].cellules["bovigrip-primo"].statut, "FAIT");
  assert.equal(lignes[0].cellules["bovigrip-primo"].aValider, true);
});

test("un protocole à une seule étape (ex: Nasalgen sans rappel configuré) rattache automatiquement un acte orphelin, sans ambiguïté possible", () => {
  const etapeUnique = {
    id: "nasalgen-primo", label: "Primo", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE",
    debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 30, finUnite: "JOUR", finPosition: "APRES",
    medicamentId: "med-nasalgen", medicamentNom: "NASALGEN",
    medicaments: [{ medicament: { id: "med-nasalgen", nom: "NASALGEN" } }],
  };
  const protocoleNasalgen: ProtocoleGrille = { ...protocoleBovigrip, id: "proto-nasalgen", nom: "NASALGEN", label: "Nasalgen", etapes: [etapeUnique] };
  const dateActe = jours(5);
  const a = animal({
    danaisIso: jours(0).toISOString(),
    actes: [{ date: dateActe, vaccin: "NASALGEN", medicamentId: "med-nasalgen", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" }],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocoleNasalgen], [], AUJOURDHUI);
  const cellule = lignes[0].cellules["nasalgen-primo"];
  assert.equal(cellule.statut, "FAIT", "une seule étape possible : le rattachement est automatique, pas ambigu");
  assert.equal(cellule.date?.toISOString(), dateActe.toISOString());
  assert.equal(cellule.aValider, false);
});

test("un vaccin de pharmacie sans protocole affiche fait dès qu'un acte existe, sans inventer d'échéance", () => {
  const vaccin: VaccinPharmacieGrille = { medicamentId: "med-nasym", nom: "NASYM", voie: "IN" };
  const dateActe = jours(10);
  const a = animal({ actes: [{ date: dateActe, vaccin: "NASYM", medicamentId: "med-nasym", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" }] });
  const { lignes } = construireGrilleVaccinale([a], [], [vaccin], AUJOURDHUI);
  const cellule = lignes[0].cellules["med-nasym"];
  assert.equal(cellule.statut, "FAIT");
  assert.equal(cellule.date?.toISOString(), dateActe.toISOString());

  const sansActe = animal({ actes: [] });
  const { lignes: lignes2 } = construireGrilleVaccinale([sansActe], [], [vaccin], AUJOURDHUI);
  assert.equal(lignes2[0].cellules["med-nasym"].statut, "VIDE");
});
