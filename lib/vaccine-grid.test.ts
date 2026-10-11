import assert from "node:assert/strict";
import test from "node:test";
import { bornerFenetreInitialeAuVelage, construireBlocsVaccinaux, construireGrilleVaccinale, extraireActionsPrevues, type AnimalGrille, type ProtocoleGrille, type VaccinPharmacieGrille } from "./vaccine-grid.ts";

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

test("un vaccin actif de pharmacie comme ROTAVEC reste représenté même sans protocole", () => {
  const vaccin: VaccinPharmacieGrille = { medicamentId: "med-rotavec", nom: "ROTAVEC", voie: "IM" };
  const { blocs, lignes } = construireGrilleVaccinale([animal()], [], [vaccin], AUJOURDHUI);
  assert.equal(blocs[0].nom, "ROTAVEC");
  assert.equal(blocs[0].sousColonnes[0].protocoleId, null);
  assert.equal(lignes[0].cellules["med-rotavec"].statut, "VIDE");
  assert.equal(lignes[0].cellules["med-rotavec"].rattachementProtocoleAutorise, false);
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
  assert.equal(sansHistorique[0].cellules["bovigrip-primo"].rattachementProtocoleAutorise, false, "une saisie volontaire restera un traitement factuel sans faux rattachement au protocole");

  const dateActe = jours(20);
  const avecActe = animal({ sexe: "M", actes: [{ date: dateActe, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: "proto-bovigrip", etapeProtocoleId: "bovigrip-primo", gestationId: null, statut: "FAIT" }] });
  const { lignes: avecHistorique } = construireGrilleVaccinale([avecActe], [protocoleFemelles], [], AUJOURDHUI);
  assert.equal(avecHistorique[0].cellules["bovigrip-primo"].statut, "FAIT", "un fait réel reste visible même si l'animal n'est plus éligible aujourd'hui");
  assert.equal(avecHistorique[0].cellules["bovigrip-primo"].date?.toISOString(), dateActe.toISOString());
  assert.equal(avecHistorique[0].cellules["bovigrip-rappel"].statut, "VIDE", "le rappel, lui, n'est pas inventé pour un animal non concerné");
});

test("une étape connue sans échéance calculable reste saisissable et peut conserver son rattachement", () => {
  const rappelSansPrimo = animal({ danaisIso: jours(-100).toISOString() });
  const { lignes } = construireGrilleVaccinale([rappelSansPrimo], [protocoleBovigrip], [], AUJOURDHUI);
  assert.equal(lignes[0].cellules["bovigrip-rappel"].statut, "VIDE");
  assert.equal(lignes[0].cellules["bovigrip-rappel"].rattachementProtocoleAutorise, true);
});

test("un historique ambigu expose sa source sans modifier le fait réel", () => {
  const a = animal({
    actes: [
      { sourceType: "VACCINATION", sourceId: "vaccination-1", date: jours(20), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
      { sourceType: "VACCINATION", sourceId: "vaccination-2", date: jours(50), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: null, etapeProtocoleId: null, gestationId: null, statut: "FAIT" },
    ],
  });
  const { lignes } = construireGrilleVaccinale([a], [protocoleBovigrip], [], AUJOURDHUI);
  const historiques = lignes[0].cellules["bovigrip-primo"].historiquesAValider;
  assert.deepEqual(historiques.map((historique) => historique.sourceId), ["vaccination-1", "vaccination-2"]);
  assert.ok(historiques.every((historique) => historique.sourceType === "VACCINATION"));
  assert.deepEqual(historiques.map((historique) => historique.date), [jours(20), jours(50)]);
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

test("une étape liée au vêlage suit exclusivement la fenêtre configurée dans le protocole", () => {
  const velage = new Date("2026-12-01T12:00:00Z");
  const etapeVelage = {
    ...etapePrimo,
    id: "crypto-velage",
    label: "Injection",
    reference: "VELAGE",
    debutValeur: 90,
    debutUnite: "JOUR",
    debutPosition: "AVANT",
    finValeur: 21,
    finUnite: "JOUR",
    finPosition: "AVANT",
  };
  const protocole = { ...protocoleBovigrip, id: "proto-crypto", etapes: [etapeVelage] };
  const gestante = animal({ gestationId: "gestation-1", dateVelagePrevueIso: velage.toISOString() });

  const selonFenetreConfiguree = construireGrilleVaccinale([gestante], [protocole], [], AUJOURDHUI);
  assert.equal(selonFenetreConfiguree.lignes[0].cellules["crypto-velage"].statut, "A_FAIRE");

  const protocoleModifie = {
    ...protocole,
    etapes: [{ ...etapeVelage, debutValeur: 10, finValeur: 5 }],
  };
  const apresModification = construireGrilleVaccinale([gestante], [protocoleModifie], [], AUJOURDHUI);
  // Échéance encore lointaine : elle reste visible (prévu plus tard), jamais masquée.
  assert.equal(apresModification.lignes[0].cellules["crypto-velage"].statut, "PREVU");
  assert.ok(apresModification.lignes[0].cellules["crypto-velage"].date);
});

test("grille et Agenda utilisent la branche questionnaire et sa préconisation Pharmacie", () => {
  const date = new Date("2026-03-01T12:00:00Z");
  const configuration = {
    version: 1, medicamentId: "med-bovigrip", cible: { tousBovins: true, categories: [] },
    demarrage: { type: "PRIMO_RAPPEL", etapePrimoId: "bovigrip-primo", etapeRappelId: "bovigrip-rappel", calendrierPrimo: { type: "AGE_MINIMUM", age: { valeur: 0, unite: "JOUR" } }, rappel: { type: "BRANCHES_AGE_PRIMO", seuilAgePrimo: { valeur: 2.5, unite: "MOIS" }, resterDansFenetrePrimo: false, branches: [
      { id: "avant", position: "AVANT_SEUIL", preconisationPrimoId: "p-in", delaiRappel: { valeur: 8, unite: "SEMAINE" }, preconisationRappelId: "p-im" },
      { id: "apres", position: "A_PARTIR_SEUIL", preconisationPrimoId: "p-im", delaiRappel: { valeur: 4, unite: "SEMAINE" }, preconisationRappelId: "p-im" },
    ] } }, entretien: { actif: false },
  };
  const protocole: ProtocoleGrille = {
    ...protocoleBovigrip,
    configurationQuestionnaireJson: JSON.stringify(configuration),
    etapes: [
      { ...etapePrimo, preconisations: [{ id: "p-in", voie: "IN", dose: 2, unite: "ml" }, { id: "p-im", voie: "IM", dose: 2, unite: "ml" }] },
      { ...etapeRappel, preconisations: [{ id: "p-im", voie: "IM", dose: 2, unite: "ml" }] },
    ],
  };
  const a = animal({ danaisIso: new Date("2026-01-01T12:00:00Z").toISOString(), statutsProtocoles: [{ protocoleId: protocole.id, statut: "PRIMO_A_FAIRE", brancheInitialeId: null }] });
  const grille = construireGrilleVaccinale([a], [protocole], [], date);
  assert.equal(grille.lignes[0].cellules["bovigrip-primo"].voie, "IN");
  assert.equal(extraireActionsPrevues(grille)[0].etapeId, "bovigrip-primo");
});

test("un entretien historique acquiert l'initial et planifie l'entretien du nouveau cycle", () => {
  const velage = new Date("2027-02-15T12:00:00Z");
  const entretien = {
    ...etapePrimo,
    id: "entretien-annuel",
    label: "Rappel annuel",
    ordre: 2,
    cycle: "ENTRETIEN",
    reference: "VELAGE",
    debutValeur: 90,
    debutPosition: "AVANT",
    finValeur: 21,
    finPosition: "AVANT",
  };
  const protocole = { ...protocoleBovigrip, etapes: [etapePrimo, etapeRappel, entretien] };
  const gestante = animal({
    gestationId: "gestation-courante",
    dateVelagePrevueIso: velage.toISOString(),
    statutsProtocoles: [{ protocoleId: protocole.id, statut: "PRIMO_A_FAIRE" }],
    actes: [
      { date: new Date("2025-02-10T12:00:00Z"), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: protocole.id, etapeProtocoleId: entretien.id, gestationId: "ancienne-gestation", statut: "FAIT" },
    ],
  });
  const grille = construireGrilleVaccinale([gestante], [protocole], [], AUJOURDHUI);
  assert.equal(grille.lignes[0].cellules[etapePrimo.id].statut, "VIDE");
  assert.equal(grille.lignes[0].cellules[etapeRappel.id].statut, "VIDE");
  assert.notEqual(grille.lignes[0].cellules[entretien.id].statut, "VIDE");
  assert.deepEqual(extraireActionsPrevues(grille).map((action) => action.etapeId), [entretien.id]);
});

test("PALUCHE : l'entretien CRYPTIUM historique reste visible et seul l'entretien de la nouvelle gestation est à faire", () => {
  const primo = { ...etapePrimo, id: "cryptium-primo", medicamentId: "med-cryptium", medicamentNom: "BOVILIS CRYPTIUM", medicaments: [{ medicament: { id: "med-cryptium", nom: "BOVILIS CRYPTIUM" } }], preconisations: [{ id: "precon-sc", voie: "SC", dose: 2, unite: "ml" }] };
  const rappel = { ...etapeRappel, id: "cryptium-rappel", medicamentId: "med-cryptium", medicamentNom: "BOVILIS CRYPTIUM", medicaments: [{ medicament: { id: "med-cryptium", nom: "BOVILIS CRYPTIUM" } }], preconisations: [{ id: "precon-sc", voie: "SC", dose: 2, unite: "ml" }] };
  const entretien = { ...primo, id: "cryptium-entretien", label: "Entretien", ordre: 2, cycle: "ENTRETIEN" };
  const configuration = {
    version: 1,
    medicamentId: "med-cryptium",
    cible: { tousBovins: false, categories: ["GENISSE", "VACHE"] },
    demarrage: {
      type: "PRIMO_RAPPEL", etapePrimoId: primo.id, etapeRappelId: rappel.id,
      calendrierPrimo: { type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } },
      rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "precon-sc", preconisationRappelId: "precon-sc", resterDansFenetrePrimo: true },
    },
    entretien: { actif: true, etapeId: entretien.id, preconisationId: "precon-sc", calendrier: { type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } } },
  };
  const protocole: ProtocoleGrille = {
    ...protocoleBovigrip, id: "proto-cryptium", nom: "BOVILIS_CRYPTIUM", label: "BOVILIS CRYPTIUM",
    categoriesJson: JSON.stringify(["GENISSE", "VACHE"]), configurationQuestionnaireJson: JSON.stringify(configuration),
    etapes: [primo, rappel, entretien],
  };
  const entretienHistorique = new Date("2025-10-01T12:00:00Z");
  const paluche = animal({
    id: "paluche", nutrav: "PALUCHE", nom: "PALUCHE", categorie: "VACHE", nombreVelages: 2,
    gestationId: "gestation-n-plus-1", dateVelagePrevueIso: "2026-12-01T12:00:00Z",
    statutsProtocoles: [{ protocoleId: protocole.id, statut: "PRIMO_A_FAIRE", brancheInitialeId: null }],
    actes: [{ date: entretienHistorique, vaccin: "BOVILIS CRYPTIUM", medicamentId: "med-cryptium", protocoleId: protocole.id, etapeProtocoleId: entretien.id, gestationId: "gestation-n", statut: "FAIT" }],
  });
  const grille = construireGrilleVaccinale([paluche], [protocole], [], AUJOURDHUI);
  const ligne = grille.lignes[0];
  assert.equal(ligne.cellules[primo.id].statut, "VIDE");
  assert.equal(ligne.cellules[rappel.id].statut, "VIDE");
  assert.equal(ligne.cellules[entretien.id].statut, "A_FAIRE");
  assert.equal(ligne.actes.some((acte) => acte.date.getTime() === entretienHistorique.getTime() && acte.etapeProtocoleId === entretien.id), true);
  assert.deepEqual(extraireActionsPrevues(grille).map((action) => ({ etapeId: action.etapeId, statut: action.statut })), [{ etapeId: entretien.id, statut: "A_FAIRE" }]);
});

test("un entretien du cycle courant acquiert l'initial et ne crée aucune nouvelle échéance", () => {
  const entretien = { ...etapePrimo, id: "entretien", label: "Entretien", ordre: 2, cycle: "ENTRETIEN", reference: "VELAGE", debutValeur: 90, debutPosition: "AVANT", finValeur: 21, finPosition: "AVANT" };
  const protocole = { ...protocoleBovigrip, etapes: [etapePrimo, etapeRappel, entretien] };
  const dateActe = new Date("2026-09-20T12:00:00Z");
  const gestante = animal({
    gestationId: "g1",
    dateVelagePrevueIso: "2026-12-01T12:00:00Z",
    statutsProtocoles: [{ protocoleId: protocole.id, statut: "PRIMO_A_FAIRE" }],
    actes: [{ date: dateActe, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: protocole.id, etapeProtocoleId: entretien.id, gestationId: "g1", statut: "FAIT" }],
  });
  const grille = construireGrilleVaccinale([gestante], [protocole], [], AUJOURDHUI);
  const { lignes } = grille;
  assert.equal(lignes[0].cellules[entretien.id].statut, "FAIT");
  assert.equal(lignes[0].cellules[etapePrimo.id].statut, "VIDE");
  assert.equal(lignes[0].cellules[etapeRappel.id].statut, "VIDE");
  assert.deepEqual(extraireActionsPrevues(grille), []);
});

test("PRIMO_EN_COURS continue le rappel initial configuré", () => {
  const datePrimo = new Date("2026-09-10T12:00:00Z");
  const enCours = animal({
    danaisIso: "2026-01-01T12:00:00Z",
    statutsProtocoles: [{ protocoleId: protocoleBovigrip.id, statut: "PRIMO_EN_COURS" }],
    actes: [{ date: datePrimo, vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: protocoleBovigrip.id, etapeProtocoleId: etapePrimo.id, gestationId: null, statut: "FAIT" }],
  });
  const { lignes } = construireGrilleVaccinale([enCours], [protocoleBovigrip], [], AUJOURDHUI);
  assert.equal(lignes[0].cellules[etapePrimo.id].statut, "FAIT");
  assert.notEqual(lignes[0].cellules[etapeRappel.id].statut, "VIDE");
});

test("PRIMO_A_FAIRE commence au premier initial tandis que A_CONFIRMER ne recommande rien", () => {
  const aFaire = animal({ statutsProtocoles: [{ protocoleId: protocoleBovigrip.id, statut: "PRIMO_A_FAIRE" }] });
  const aConfirmer = animal({ id: "a2", statutsProtocoles: [{ protocoleId: protocoleBovigrip.id, statut: "A_CONFIRMER" }] });
  const { lignes } = construireGrilleVaccinale([aFaire, aConfirmer], [protocoleBovigrip], [], AUJOURDHUI);
  assert.notEqual(lignes[0].cellules[etapePrimo.id].statut, "VIDE");
  assert.equal(lignes[0].cellules[etapeRappel.id].statut, "VIDE");
  assert.equal(extraireActionsPrevues({ blocs: construireBlocsVaccinaux([protocoleBovigrip], []), lignes: [lignes[1]] }).length, 0);
});

test("une étape initiale calculée entièrement après le vêlage est absente de la grille et de l'Agenda", () => {
  const primoVelage = { ...etapePrimo, id: "primo-velage", reference: "VELAGE", debutValeur: 60, debutPosition: "AVANT", finValeur: 50, finPosition: "AVANT" };
  const rappelApres = { ...etapeRappel, id: "rappel-apres", debutValeur: 70, finValeur: 80 };
  const protocole = { ...protocoleBovigrip, id: "proto-pre-velage", etapes: [primoVelage, rappelApres] };
  const gestante = animal({
    gestationId: "g1",
    dateVelagePrevueIso: "2026-12-01T12:00:00Z",
    statutsProtocoles: [{ protocoleId: protocole.id, statut: "PRIMO_EN_COURS" }],
    actes: [{ date: new Date("2026-10-10T12:00:00Z"), vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip", protocoleId: protocole.id, etapeProtocoleId: primoVelage.id, gestationId: "g1", statut: "FAIT" }],
  });
  const grille = construireGrilleVaccinale([gestante], [protocole], [], AUJOURDHUI);
  assert.equal(grille.lignes[0].cellules[rappelApres.id].statut, "VIDE");
  assert.equal(extraireActionsPrevues(grille).some((action) => action.etapeId === rappelApres.id), false);
});

test("une fenêtre initiale qui chevauche le vêlage est bornée au jour du vêlage", () => {
  const velage = new Date("2026-12-01T12:00:00Z");
  const fenetre = bornerFenetreInitialeAuVelage({
    debut: new Date("2026-11-20T12:00:00Z"),
    fin: new Date("2026-12-10T12:00:00Z"),
  }, velage, true);
  assert.equal(fenetre?.debut.toISOString(), "2026-11-20T12:00:00.000Z");
  assert.equal(fenetre?.fin.toISOString(), velage.toISOString());
});
