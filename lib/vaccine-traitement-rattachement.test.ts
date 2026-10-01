import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unifierActesVaccinaux, type ActeVaccination } from "./vaccine-acts.ts";
import { medicamentCompatibleAvecEtape, protocoleLieAuVelage } from "./vaccine-attachment.ts";
import { construireGrilleVaccinale, type AnimalGrille, type EtapeGrille, type ProtocoleGrille } from "./vaccine-grid.ts";

const AUJOURDHUI = new Date("2026-10-15T12:00:00Z");
const NAISSANCE = new Date("2026-06-01T12:00:00Z");
const DATE_ACTE = new Date("2026-10-01T12:00:00Z");

const etape = (id: string, label: string, ordre: number, reference: string, medicamentId: string | null): EtapeGrille => ({
  id, label, ordre, cycle: "INITIAL", reference,
  debutValeur: ordre === 0 ? 14 : 28, debutUnite: "JOUR", debutPosition: "APRES",
  finValeur: ordre === 0 ? 200 : 35, finUnite: "JOUR", finPosition: "APRES",
  medicamentId, medicamentNom: medicamentId ? "HIPRABOVIS SOMNI" : null,
  medicaments: medicamentId ? [{ medicament: { id: medicamentId, nom: "HIPRABOVIS SOMNI" } }] : [],
});

const protocole = (etapes: EtapeGrille[], id = "proto-somni"): ProtocoleGrille => ({
  id, nom: id.toUpperCase(), label: "Somni", ageMinJours: 0, ageMaxJours: null,
  categoriesJson: null, sexeCible: null, gestante: null, rangVelageMin: null, rangVelageMax: null, lotCible: null,
  etapes,
});

const primo = etape("somni-primo", "Primo", 0, "NAISSANCE", "med-somni");
const rappel = etape("somni-rappel", "Rappel", 1, "ETAPE_PRECEDENTE", "med-somni");

const animal = (actes: ActeVaccination[]): AnimalGrille => ({
  id: "a1", nutrav: "7483", nom: "BRIGITTE", sexe: "F", danaisIso: NAISSANCE.toISOString(),
  categorie: "VELLE", nombreVelages: 0, groupeNom: null, gestationId: null, dateVelagePrevueIso: null, actes,
});

const traitement = (extra: Record<string, unknown> = {}) => ({
  id: "t1", dateDebut: DATE_ACTE, medicamentNom: "HIPRABOVIS SOMNI", medicamentId: "med-somni", ...extra,
});

test("un Traitement VACCIN non rattaché reste un acte FAIT réel, sans protocole", () => {
  const [acte] = unifierActesVaccinaux([], [traitement()]);
  assert.equal(acte.statut, "FAIT");
  assert.equal(acte.sourceType, "TRAITEMENT");
  assert.equal(acte.protocoleId, null);
  assert.equal(acte.etapeProtocoleId, null);
  assert.equal(acte.gestationId, null);
});

test("unifierActesVaccinaux restitue protocole, étape et gestation du Traitement rattaché", () => {
  const [acte] = unifierActesVaccinaux([], [
    traitement({ protocoleVaccinId: "proto-somni", etapeProtocoleVaccinId: "somni-primo", gestationId: "g1" }),
  ]);
  assert.equal(acte.sourceType, "TRAITEMENT");
  assert.equal(acte.sourceId, "t1");
  assert.equal(acte.date, DATE_ACTE);
  assert.equal(acte.medicamentId, "med-somni");
  assert.equal(acte.protocoleId, "proto-somni");
  assert.equal(acte.etapeProtocoleId, "somni-primo");
  assert.equal(acte.gestationId, "g1");
  assert.equal(acte.statut, "FAIT");
});

test("la Vaccination structurée du même jour reste prioritaire : aucun double acte", () => {
  const vaccination: ActeVaccination = {
    sourceType: "VACCINATION", sourceId: "v1", date: DATE_ACTE, vaccin: "HIPRABOVIS SOMNI", medicamentId: "med-somni",
    protocoleId: "proto-somni", etapeProtocoleId: "somni-primo", gestationId: null, statut: "FAIT",
  };
  const actes = unifierActesVaccinaux([vaccination], [
    traitement({ protocoleVaccinId: "proto-somni", etapeProtocoleVaccinId: "somni-rappel" }),
  ]);
  assert.equal(actes.length, 1);
  assert.equal(actes[0].sourceType, "VACCINATION");
  assert.equal(actes[0].etapeProtocoleId, "somni-primo");
});

test("grille : avant rattachement le Traitement est signalé à rattacher avec ses étapes compatibles", () => {
  const protocoles = [protocole([primo, rappel, etape("somni-autre", "Autre", 2, "NAISSANCE", "med-autre")])];
  const orphelins = unifierActesVaccinaux([], [traitement(), traitement({ id: "t2", dateDebut: new Date("2026-10-02T12:00:00Z") })]);
  const { lignes } = construireGrilleVaccinale([animal(orphelins)], protocoles, [], AUJOURDHUI);
  const cellule = lignes[0].cellules["somni-primo"];
  assert.equal(cellule.aValider, true);
  assert.equal(cellule.historiquesAValider[0].sourceType, "TRAITEMENT");
  assert.deepEqual(cellule.historiquesAValider[0].etapesCompatibles.map((e) => e.id), ["somni-primo", "somni-rappel"]);
  assert.equal(cellule.historiquesAValider[0].protocoleLieAuVelage, false);
});

test("grille : aucune étape compatible quand le médicament réel n'est lié à aucune étape", () => {
  const protocoles = [protocole([etape("x-primo", "Primo", 0, "NAISSANCE", "med-autre"), etape("x-rappel", "Rappel", 1, "ETAPE_PRECEDENTE", "med-autre")])];
  const orphelins = unifierActesVaccinaux([], [traitement(), traitement({ id: "t2", dateDebut: new Date("2026-10-02T12:00:00Z") })]);
  const { lignes } = construireGrilleVaccinale([animal(orphelins)], protocoles, [], AUJOURDHUI);
  const historiques = Object.values(lignes[0].cellules).flatMap((c) => c.historiquesAValider);
  // Rattachés par nom au protocole seulement si le médicament y figure : ici rien de compatible.
  assert.ok(historiques.length > 0);
  for (const historique of historiques) assert.deepEqual(historique.etapesCompatibles, []);
});

test("après rattachement : l'étape est FAIT à la vraie date et le rappel part de cette date", () => {
  const protocoles = [protocole([primo, rappel])];
  const actes = unifierActesVaccinaux([], [
    traitement({ protocoleVaccinId: "proto-somni", etapeProtocoleVaccinId: "somni-primo" }),
  ]);
  const { lignes } = construireGrilleVaccinale([animal(actes)], protocoles, [], new Date("2026-10-31T12:00:00Z"));
  const cellules = lignes[0].cellules;
  assert.equal(cellules["somni-primo"].statut, "FAIT");
  assert.equal(cellules["somni-primo"].date?.getTime(), DATE_ACTE.getTime());
  assert.equal(cellules["somni-primo"].aValider, false);
  assert.notEqual(cellules["somni-rappel"].statut, "FAIT");
  // Fin de fenêtre du rappel = date réelle + 35 jours.
  assert.equal(cellules["somni-rappel"].date?.toISOString().slice(0, 10), "2026-11-05");
});

test("la gestation n'est exposée que pour un protocole lié au vêlage", () => {
  const velage = protocole([etape("v-primo", "Pré-vêlage", 0, "VELAGE", "med-somni"), etape("v-rappel", "Rappel", 1, "ETAPE_PRECEDENTE", "med-somni")], "proto-velage");
  const orphelins = unifierActesVaccinaux([], [traitement()]);
  const { lignes } = construireGrilleVaccinale([animal(orphelins)], [velage], [], AUJOURDHUI);
  const historique = Object.values(lignes[0].cellules).flatMap((c) => c.historiquesAValider)[0];
  assert.equal(historique.protocoleLieAuVelage, true);
  assert.equal(protocoleLieAuVelage({ etapes: [{ id: "a", reference: "NAISSANCE", medicaments: [] }] }), false);
});

test("compatibilité médicament/étape : refuse un médicament ou une étape d'un autre protocole", () => {
  const proto = {
    etapes: [
      { id: "e1", reference: "NAISSANCE", medicaments: [{ medicamentId: "med-somni" }] },
      { id: "e2", reference: "ETAPE_PRECEDENTE", medicaments: [] },
      { id: "e3", reference: "NAISSANCE", medicaments: [{ medicamentId: "med-autre" }] },
    ],
  };
  assert.equal(medicamentCompatibleAvecEtape(proto, "e1", "med-somni"), true);
  assert.equal(medicamentCompatibleAvecEtape(proto, "e2", "med-somni"), true, "étape sans médicament lié, produit utilisé dans le protocole");
  assert.equal(medicamentCompatibleAvecEtape(proto, "e3", "med-somni"), false);
  assert.equal(medicamentCompatibleAvecEtape(proto, "e2", "med-inconnu"), false);
  assert.equal(medicamentCompatibleAvecEtape(proto, "etape-autre-protocole", "med-somni"), false);
});

test("la route de rattachement valide le traitement et ne crée jamais de Vaccination", () => {
  const source = readFileSync(new URL("../app/api/traitements/[id]/rattachement-vaccinal/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /prisma\.vaccination\./);
  assert.doesNotMatch(source, /\.create\(/);
  assert.match(source, /categorie !== "VACCIN"/);
  assert.match(source, /n’appartient pas à ce protocole/);
  assert.match(source, /medicamentCompatibleAvecEtape/);
  assert.match(source, /gestationIdAEnregistrer/);
  assert.match(source, /saillie: \{ animalId: traitement\.animalId \}/);
  const update = source.match(/prisma\.traitement\.update\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  assert.match(update, /protocoleVaccinId/);
  assert.doesNotMatch(update, /medicamentId|dateDebut|medicamentNom|dose/);
});
