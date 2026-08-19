import assert from "node:assert/strict";
import test from "node:test";
import { ordonnanceSourceKey, regrouperOrdonnancesPourListe } from "./ordonnance-list.ts";

function row(id: string, sourceKey: string, medicaments: string[] = []) {
  return {
    id,
    sourceKey,
    statut: "VALIDE",
    medicamentNom: medicaments[0] ?? "",
    medicaments: medicaments.map((nomExtrait) => ({ nomExtrait, conditionnement: null })),
  };
}

test("regroupe les médicaments provenant du même document dans une seule ordonnance", () => {
  const groupes = regrouperOrdonnancesPourListe([
    row("ord-1", "document:scan-unique", ["BOOST’VO"]),
    row("ord-2", "document:scan-unique", ["RISPOVAL"]),
    row("ord-3", "document:scan-unique", ["CANDILAT"]),
  ]);

  assert.equal(groupes.length, 1);
  assert.deepEqual(groupes[0].medicaments, [
    { nomExtrait: "BOOST’VO", conditionnement: null },
    { nomExtrait: "RISPOVAL", conditionnement: null },
    { nomExtrait: "CANDILAT", conditionnement: null },
  ]);
});

test("ne fusionne jamais deux ordonnances différentes ayant seulement la même date", () => {
  const groupes = regrouperOrdonnancesPourListe([
    row("ord-1", ordonnanceSourceKey({ id: "ord-1" }), ["BOOST’VO"]),
    row("ord-2", ordonnanceSourceKey({ id: "ord-2" }), ["RISPOVAL"]),
  ]);

  assert.equal(groupes.length, 2);
});

test("utilise le document partagé puis l'extraction, sans jamais utiliser la date", () => {
  assert.equal(
    ordonnanceSourceKey({ id: "ord-1", extractionId: "ext-1", photoUrl: "page.jpg" }),
    "document:page.jpg",
  );
  assert.equal(
    ordonnanceSourceKey({ id: "ord-1", photoUrls: JSON.stringify(["page-1.jpg", "page-2.jpg"]) }),
    'documents:["page-1.jpg","page-2.jpg"]',
  );
  assert.equal(ordonnanceSourceKey({ id: "ord-1", extractionId: "ext-1" }), "extraction:ext-1");
});

test("conserve comme lien la ligne qui contient déjà l'ordonnance complète", () => {
  const groupes = regrouperOrdonnancesPourListe([
    row("ord-partielle", "document:scan-unique", ["BOOST’VO"]),
    row("ord-complete", "document:scan-unique", ["BOOST’VO", "RISPOVAL", "CANDILAT"]),
  ]);

  assert.equal(groupes[0].id, "ord-complete");
  assert.equal(groupes[0].medicaments?.length, 3);
});
