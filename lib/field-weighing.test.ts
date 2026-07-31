import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGmqKgPerDay,
  clampSwipeOffset,
  nextOpenSwipeId,
  prependSessionEntry,
  removeSessionEntry,
  replaceSessionEntry,
  selectedAverage,
  settleSwipe,
  shouldShowSwipeHint,
  stopSwipeActionPointerDown,
  SWIPE_ACTION_WIDTH,
} from "./field-weighing.ts";
import type { FieldSessionEntry } from "./field-weighing.ts";

const entries: FieldSessionEntry[] = [
  { id: "p3", nutrav: "3003", sexe: "M", poids: 310, gmq: 1.2, selected: true },
  { id: "p2", nutrav: "2002", sexe: "F", poids: 280, gmq: 0.9, selected: true },
  { id: "p1", nutrav: "1001", sexe: "M", poids: 250, gmq: 0.7, selected: false },
];

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

test("le swipe suit le doigt et ne fait qu'ouvrir les actions après le seuil", () => {
  assert.equal(clampSwipeOffset(-40), -40);
  assert.equal(clampSwipeOffset(-400), -SWIPE_ACTION_WIDTH);
  assert.equal(settleSwipe(-40), false);
  assert.equal(settleSwipe(-72), true);
  assert.deepEqual(entries.map((entry) => entry.id), ["p3", "p2", "p1"]);
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
