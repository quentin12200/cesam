import assert from "node:assert/strict";
import test from "node:test";
import {
  ageAlertLabel,
  averageWeight,
  calculateGmqKgPerDay,
  clampSwipeOffset,
  detectSwipeAxis,
  fieldAgeInfo,
  fieldAgeAlertSummary,
  hydrateFieldSessionEntries,
  motherNumberLabel,
  needsFieldAnimalDetails,
  nextOpenSwipeId,
  prependSessionEntry,
  removeSessionEntry,
  replaceSessionEntry,
  selectedAverage,
  selectedWeightSummary,
  settleSwipe,
  settledSwipeOffset,
  shouldShowSwipeHint,
  stableSwipeOffset,
  stopSwipeActionPointerDown,
  SWIPE_ACTION_WIDTH,
  swipeToggleLabel,
  weightProgressLabel,
} from "./field-weighing.ts";
import type { FieldSessionEntry } from "./field-weighing.ts";

const entries: FieldSessionEntry[] = [
  { id: "p3", nutrav: "3003", mereNutrav: "6393", birthDate: "2025-09-13T12:00:00.000Z", sexe: "M", poids: 310, gmq: 1.2, selected: true },
  { id: "p2", nutrav: "2002", sexe: "F", poids: 280, gmq: 0.9, selected: true },
  { id: "p1", nutrav: "1001", sexe: "M", poids: 250, gmq: 0.7, selected: false },
];

test("affiche le numéro de la mère sans le confondre avec celui du veau", () => {
  assert.equal(entries[0].nutrav, "3003");
  assert.equal(motherNumberLabel(entries[0]), "Mère 6393");
  assert.notEqual(entries[0].nutrav, entries[0].mereNutrav);
});

test("affiche une mère inconnue lorsque la relation est absente", () => {
  assert.equal(motherNumberLabel(entries[1]), "Mère inconnue");
});

test("affiche Première pesée sur sa ligne dédiée sans GMQ", () => {
  assert.equal(weightProgressLabel({ gmq: null }), "Première pesée");
});

test("affiche le GMQ formaté sur sa ligne dédiée", () => {
  assert.equal(weightProgressLabel({ gmq: 2.3 }), "GMQ 2,3 kg/j");
});

test("conserve le numéro de mère après rechargement de la séance locale", () => {
  const restored = JSON.parse(JSON.stringify({ entries })) as { entries: FieldSessionEntry[] };

  assert.equal(restored.entries[0].mereNutrav, "6393");
  assert.equal(motherNumberLabel(restored.entries[0]), "Mère 6393");
  assert.equal(restored.entries[0].birthDate, "2025-09-13T12:00:00.000Z");
});

test("réhydrate un animal avec mère et date de naissance", () => {
  const incomplete = [{ ...entries[0], mereNutrav: undefined, birthDate: undefined }];
  const hydrated = hydrateFieldSessionEntries(incomplete, [{
    nutrav: "3003", mereNutrav: "6393", birthDate: "2025-09-13T12:00:00.000Z",
  }]);

  assert.equal(motherNumberLabel(hydrated[0]), "Mère 6393");
  assert.notEqual(fieldAgeInfo(hydrated[0].birthDate).label, "Âge inconnu");
  assert.equal(hydrated[0].id, incomplete[0].id);
});

test("réhydrate une date connue sans inventer de mère", () => {
  const hydrated = hydrateFieldSessionEntries([entries[1]], [{
    nutrav: "2002", mereNutrav: null, birthDate: "2025-10-01T12:00:00.000Z",
  }]);

  assert.equal(motherNumberLabel(hydrated[0]), "Mère inconnue");
  assert.equal(hydrated[0].birthDate, "2025-10-01T12:00:00.000Z");
});

test("réhydrate une mère connue même si la date est absente", () => {
  const hydrated = hydrateFieldSessionEntries([entries[1]], [{
    nutrav: "2002", mereNutrav: "7007", birthDate: null,
  }]);

  assert.equal(motherNumberLabel(hydrated[0]), "Mère 7007");
  assert.equal(fieldAgeInfo(hydrated[0].birthDate).label, "Âge inconnu");
});

test("réhydrate une ancienne séance sans doublon et conserve les données au rechargement", () => {
  const oldEntries = entries.map((entry) => ({ ...entry, mereNutrav: undefined, birthDate: undefined }));
  const hydrated = hydrateFieldSessionEntries(oldEntries, [{
    nutrav: "3003", mereNutrav: "6393", birthDate: "2025-09-13T12:00:00.000Z",
  }]);
  const restored = JSON.parse(JSON.stringify(hydrated)) as FieldSessionEntry[];

  assert.equal(restored.length, oldEntries.length);
  assert.deepEqual(restored.map((entry) => entry.id), oldEntries.map((entry) => entry.id));
  assert.equal(restored[0].mereNutrav, "6393");
  assert.equal(restored[0].birthDate, "2025-09-13T12:00:00.000Z");
  assert.equal(needsFieldAnimalDetails(restored[0]), false);
});

test("ne remplace pas une information locale déjà connue", () => {
  const current = [entries[0]];
  const result = hydrateFieldSessionEntries(current, [{
    nutrav: "3003", mereNutrav: "9999", birthDate: "2020-01-01T12:00:00.000Z",
  }]);

  assert.equal(result, current);
  assert.equal(result[0].mereNutrav, "6393");
  assert.equal(result[0].birthDate, "2025-09-13T12:00:00.000Z");
});

const ageReference = new Date("2026-07-31T12:00:00.000Z");

test("affiche l'âge en mois et jours avant 12 mois", () => {
  assert.deepEqual(fieldAgeInfo("2025-09-13T12:00:00.000Z", ageReference), {
    label: "10 mois 18 j",
    alert: null,
  });
});

test("affiche exactement 12 mois en années et mois", () => {
  assert.deepEqual(fieldAgeInfo("2025-07-31T12:00:00.000Z", ageReference), {
    label: "1 an 0 mois",
    alert: "exceeded",
  });
});

test("affiche plus de 12 mois en années et mois", () => {
  assert.deepEqual(fieldAgeInfo("2024-05-31T12:00:00.000Z", ageReference), {
    label: "2 ans 2 mois",
    alert: "exceeded",
  });
});

test("affiche un âge inconnu sans date de naissance", () => {
  assert.deepEqual(fieldAgeInfo(null, ageReference), {
    label: "Âge inconnu",
    alert: null,
  });
});

test("ne déclenche aucune alerte à 10 mois 29 jours", () => {
  const info = fieldAgeInfo("2025-09-02T12:00:00.000Z", ageReference);
  assert.equal(info.label, "10 mois 29 j");
  assert.equal(ageAlertLabel(info.alert), null);
});

test("signale l'approche à exactement 11 mois", () => {
  const info = fieldAgeInfo("2025-08-31T12:00:00.000Z", ageReference);
  assert.equal(info.label, "11 mois 0 j");
  assert.equal(ageAlertLabel(info.alert), "⚠ Approche 12 mois");
});

test("signale encore l'approche à 11 mois 29 jours", () => {
  const info = fieldAgeInfo("2025-08-02T12:00:00.000Z", ageReference);
  assert.equal(info.label, "11 mois 29 j");
  assert.equal(ageAlertLabel(info.alert), "⚠ Approche 12 mois");
});

test("signale le dépassement à exactement 12 mois", () => {
  const info = fieldAgeInfo("2025-07-31T12:00:00.000Z", ageReference);
  assert.equal(ageAlertLabel(info.alert), "⚠ 12 mois dépassés");
});

test("l'âge inconnu ne produit aucune fausse alerte", () => {
  assert.equal(ageAlertLabel(fieldAgeInfo(null, ageReference).alert), null);
});

test("résume les alertes d'âge du récapitulatif", () => {
  assert.deepEqual(fieldAgeAlertSummary([
    { birthDate: "2025-09-02T12:00:00.000Z" },
    { birthDate: "2025-08-31T12:00:00.000Z" },
    { birthDate: "2025-07-31T12:00:00.000Z" },
    { birthDate: null },
  ], ageReference), { approaching: 1, exceeded: 1 });
});

function clickSwipeAction(action: () => void) {
  let pointerDownReachedSwipeRow = true;
  stopSwipeActionPointerDown({
    stopPropagation: () => {
      pointerDownReachedSwipeRow = false;
    },
  });
  action();
  return pointerDownReachedSwipeRow;
}

test("le clic Modifier ouvre l'édition de la bonne ligne sans déclencher le swipe", () => {
  let editingId: string | null = null;
  const pointerDownReachedSwipeRow = clickSwipeAction(() => {
    editingId = entries[1].id;
  });

  assert.equal(pointerDownReachedSwipeRow, false);
  assert.equal(editingId, "p2");
  assert.equal(editingId === entries[1].id, true);
});

test("le clic Annuler reste actif derrière le swipe et retire la bonne ligne", () => {
  let currentEntries = entries;
  const pointerDownReachedSwipeRow = clickSwipeAction(() => {
    currentEntries = removeSessionEntry(currentEntries, entries[1].id);
  });

  assert.equal(pointerDownReachedSwipeRow, false);
  assert.deepEqual(currentEntries.map((entry) => entry.id), ["p3", "p1"]);
});

test("une erreur serveur conserve les données locales", async () => {
  let currentEntries = entries;

  await assert.rejects(async () => {
    await Promise.reject(new Error("Erreur serveur"));
    currentEntries = removeSessionEntry(currentEntries, "p2");
  }, /Erreur serveur/);

  assert.equal(currentEntries, entries);
});

test("calcule le GMQ en kg/j avec une décimale", () => {
  assert.equal(
    calculateGmqKgPerDay(260, new Date("2026-07-31"), {
      poids: 200,
      date: new Date("2026-06-01"),
    }),
    1,
  );
});

test("ne calcule pas de GMQ sans poids antérieur exploitable", () => {
  assert.equal(calculateGmqKgPerDay(260, new Date("2026-07-31"), null), null);
  assert.equal(
    calculateGmqKgPerDay(260, new Date("2026-07-31"), {
      poids: 250,
      date: new Date("2026-07-31"),
    }),
    null,
  );
});

test("calcule la moyenne entière des seuls animaux sélectionnés", () => {
  assert.equal(
    selectedAverage([
      { poids: 201, selected: true },
      { poids: 204, selected: false },
      { poids: 206, selected: true },
    ]),
    204,
  );
  assert.equal(selectedAverage([{ poids: 201, selected: false }]), null);
});

test("affiche la moyenne de plusieurs animaux sélectionnés", () => {
  assert.equal(selectedWeightSummary(2, 444, "F"), "2 sélectionnées · moyenne 444 kg");
  assert.equal(selectedWeightSummary(3, 463, "M"), "3 sélectionnés · moyenne 463 kg");
});

test("affiche le poids d'un seul animal sélectionné", () => {
  assert.equal(selectedWeightSummary(1, 424, "F"), "1 sélectionnée · 424 kg");
  assert.equal(selectedWeightSummary(1, 424, "M"), "1 sélectionné · 424 kg");
});

test("affiche un état vide lorsque rien n'est sélectionné", () => {
  assert.equal(selectedWeightSummary(0, null, "F"), "0 sélectionnée · —");
  assert.equal(selectedWeightSummary(0, null, "M"), "0 sélectionné · —");
});

test("calcule les moyennes mâles et femelles sur toute la séance après ajout", () => {
  const added = prependSessionEntry(entries, {
    id: "p4", nutrav: "4004", sexe: "F", poids: 300, gmq: 1, selected: true,
  });

  assert.equal(averageWeight(added.filter((entry) => entry.sexe === "M")), 280);
  assert.equal(averageWeight(added.filter((entry) => entry.sexe === "F")), 290);
});

test("recalcule les moyennes de séance après modification et annulation", () => {
  const modified = replaceSessionEntry(entries, { ...entries[0], poids: 350 });
  const removed = removeSessionEntry(modified, "p1");

  assert.equal(averageWeight(modified.filter((entry) => entry.sexe === "M")), 300);
  assert.equal(averageWeight(removed.filter((entry) => entry.sexe === "M")), 350);
  assert.equal(averageWeight(removed.filter((entry) => entry.sexe === "F")), 280);
});

test("renvoie un état de moyenne vide pour un sexe absent", () => {
  assert.equal(averageWeight([]), null);
});

test("le swipe suit le doigt et ne fait qu'ouvrir les actions après le seuil", () => {
  assert.equal(clampSwipeOffset(-40), -40);
  assert.equal(clampSwipeOffset(-400), -SWIPE_ACTION_WIDTH);
  assert.equal(settleSwipe(-40), false);
  assert.equal(settleSwipe(-72), true);
  assert.equal(settleSwipe(-SWIPE_ACTION_WIDTH + 8, -SWIPE_ACTION_WIDTH), true);
  assert.equal(settleSwipe(-SWIPE_ACTION_WIDTH + 16, -SWIPE_ACTION_WIDTH), false);
  assert.deepEqual(entries.map((entry) => entry.id), ["p3", "p2", "p1"]);
});

test("le relâchement du swipe ne produit qu'une position complètement ouverte ou fermée", () => {
  const settledOffsets = [
    settleSwipe(-71) ? -SWIPE_ACTION_WIDTH : 0,
    settleSwipe(-72) ? -SWIPE_ACTION_WIDTH : 0,
    settleSwipe(-176, -SWIPE_ACTION_WIDTH) ? -SWIPE_ACTION_WIDTH : 0,
  ];

  assert.deepEqual(settledOffsets, [0, -SWIPE_ACTION_WIDTH, 0]);
});

test("un swipe gauche suffisant finit exactement ouvert", () => {
  assert.equal(settledSwipeOffset(-72), -SWIPE_ACTION_WIDTH);
});

test("un swipe gauche insuffisant finit exactement fermé", () => {
  assert.equal(settledSwipeOffset(-71), 0);
});

test("un petit swipe droit depuis une ligne ouverte finit exactement fermé", () => {
  assert.equal(settledSwipeOffset(-SWIPE_ACTION_WIDTH + 12, -SWIPE_ACTION_WIDTH), 0);
});

test("pointercancel et lostpointercapture restaurent toujours un offset stable", () => {
  assert.equal(stableSwipeOffset(false), 0);
  assert.equal(stableSwipeOffset(true), -SWIPE_ACTION_WIDTH);
});

test("ouvrir une nouvelle ligne ferme l'ancienne à zéro", () => {
  const openId = nextOpenSwipeId("p3", "p2", true);

  assert.equal(openId, "p2");
  assert.equal(stableSwipeOffset(false), 0);
  assert.equal(stableSwipeOffset(openId === "p2"), -SWIPE_ACTION_WIDTH);
});

test("clic extérieur, modification et annulation ferment la ligne à zéro", () => {
  for (const reason of ["outside", "edit", "delete"]) {
    const openId = nextOpenSwipeId("p2", "p2", false);
    assert.equal(openId, null, reason);
    assert.equal(stableSwipeOffset(openId === "p2"), 0, reason);
  }
});

test("un scroll vertical ne laisse aucun décalage horizontal", () => {
  assert.equal(detectSwipeAxis(3, 5), "pending");
  assert.equal(detectSwipeAxis(4, 14), "vertical");
  assert.equal(stableSwipeOffset(false), 0);
  assert.equal(stableSwipeOffset(true), -SWIPE_ACTION_WIDTH);
});

test("un swipe horizontal volontaire est détecté sur les lignes partagées", () => {
  assert.equal(detectSwipeAxis(-9, 2), "horizontal");
  assert.equal(settledSwipeOffset(-SWIPE_ACTION_WIDTH), -SWIPE_ACTION_WIDTH);
  assert.equal(detectSwipeAxis(13, 2), "horizontal");
  assert.equal(settledSwipeOffset(-SWIPE_ACTION_WIDTH + 13, -SWIPE_ACTION_WIDTH), 0);
});

test("le chevron reflète toujours l'état ouvert réel", () => {
  let openId = nextOpenSwipeId(null, "p2", true);
  assert.equal(swipeToggleLabel(openId === "p2"), "Fermer les actions");

  openId = nextOpenSwipeId(openId, "p2", false);
  assert.equal(openId, null);
  assert.equal(swipeToggleLabel(false), "Ouvrir les actions");
});

test("modifier remplace la pesée existante sans doublon et actualise son GMQ", () => {
  const updated = { ...entries[0], poids: 325, gmq: 1.5 };
  const result = replaceSessionEntry(entries, updated);

  assert.equal(result.length, 3);
  assert.equal(result.filter((entry) => entry.id === "p3").length, 1);
  assert.equal(result[0].poids, 325);
  assert.equal(result[0].gmq, 1.5);
});

test("abandonner une modification laisse toutes les données intactes", () => {
  const before = structuredClone(entries);
  const after = entries;
  assert.deepEqual(after, before);
});

test("annuler retire uniquement la dernière pesée et révèle la précédente", () => {
  const result = removeSessionEntry(entries, "p3");

  assert.deepEqual(result.map((entry) => entry.id), ["p2", "p1"]);
  assert.equal(result[0].nutrav, "2002");
  assert.equal(result[0].gmq, 0.9);
});

test("annuler une pesée intermédiaire conserve la dernière et les autres entrées", () => {
  const result = removeSessionEntry(entries, "p2");

  assert.deepEqual(result.map((entry) => entry.id), ["p3", "p1"]);
  assert.equal(result[0], entries[0]);
});

test("annuler actualise compteurs, groupes et moyennes", () => {
  const result = removeSessionEntry(entries, "p3");
  const males = result.filter((entry) => entry.sexe === "M");
  const females = result.filter((entry) => entry.sexe === "F");

  assert.equal(result.length, 2);
  assert.equal(males.length, 1);
  assert.equal(females.length, 1);
  assert.equal(selectedAverage(males), null);
  assert.equal(selectedAverage(females), 280);
});

test("annuler l'unique pesée produit l'état vide", () => {
  const result = removeSessionEntry([entries[0]], "p3");
  assert.deepEqual(result, []);
  assert.equal(result[0], undefined);
  assert.equal(selectedAverage(result), null);
});

test("le GMQ modifié reste fondé sur le poids antérieur à la séance", () => {
  const previous = { poids: 250, date: new Date("2026-06-01") };
  const gmq = calculateGmqKgPerDay(310, new Date("2026-07-31"), previous);
  const updatedGmq = calculateGmqKgPerDay(325, new Date("2026-07-31"), previous);

  assert.equal(gmq, 1);
  assert.equal(updatedGmq, 1.3);
});

test("une seule ligne de swipe peut rester ouverte", () => {
  const firstOpen = nextOpenSwipeId(null, "p3", true);
  const secondOpen = nextOpenSwipeId(firstOpen, "p2", true);

  assert.equal(firstOpen, "p3");
  assert.equal(secondOpen, "p2");
  assert.equal(nextOpenSwipeId(secondOpen, "p2", false), null);
});

test("modifier une pesée intermédiaire conserve sélection, ordre et absence de doublon", () => {
  const updated = { ...entries[1], poids: 300, gmq: 1.1 };
  const result = replaceSessionEntry(entries, updated);

  assert.deepEqual(result.map((entry) => entry.id), ["p3", "p2", "p1"]);
  assert.equal(result.filter((entry) => entry.id === "p2").length, 1);
  assert.equal(result[1].selected, true);
  assert.equal(selectedAverage(result.filter((entry) => entry.sexe === "F")), 300);
});

test("modifier un animal décoché ne change pas la moyenne sélectionnée", () => {
  const malesBefore = entries.filter((entry) => entry.sexe === "M");
  const updated = { ...entries[2], poids: 999, gmq: 3.4 };
  const result = replaceSessionEntry(entries, updated);
  const malesAfter = result.filter((entry) => entry.sexe === "M");

  assert.equal(selectedAverage(malesBefore), 310);
  assert.equal(selectedAverage(malesAfter), 310);
});

test("une nouvelle pesée est ajoutée en tête sans altérer les précédentes", () => {
  const newEntry: FieldSessionEntry = {
    id: "p4", nutrav: "4004", sexe: "F", poids: 290, gmq: 1.1, selected: true,
  };
  const result = prependSessionEntry(entries, newEntry);

  assert.deepEqual(result.map((entry) => entry.id), ["p4", "p3", "p2", "p1"]);
  assert.equal(entries.length, 3);
});

test("le chevron ouvre une seule ligne et masque ensuite l'aide locale", () => {
  assert.equal(shouldShowSwipeHint(false, 0), true);
  assert.equal(nextOpenSwipeId(null, "p2", true), "p2");
  assert.equal(shouldShowSwipeHint(true, 0), false);
  assert.equal(shouldShowSwipeHint(false, 1), false);
});
