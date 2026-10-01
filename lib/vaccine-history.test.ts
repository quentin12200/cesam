import assert from "node:assert/strict";
import test from "node:test";
import { rattacherInjectionOrpheline, rattacherPrimoNonLiee, vaccinationsSansEtapeFiable, type VaccinationHistorique } from "./vaccine-history.ts";
import { calculerActionVaccinale } from "./vaccine-planner.ts";

const protocole = {
  id: "nasalgen",
  noms: ["NASALGEN", "Nasalgen"],
  medicamentIds: ["med-nasalgen"],
  etapeIds: ["primo", "rappel"],
};
const date = new Date("2026-09-11T12:00:00Z");

function vaccination(overrides: Partial<VaccinationHistorique>): VaccinationHistorique {
  return { date, vaccin: "NASALGEN", medicamentId: null, protocoleId: null, etapeProtocoleId: null, ...overrides };
}

test("l'ancien Nasalgen sans protocole est signalé même si un statut primo à faire existe", () => {
  assert.deepEqual(vaccinationsSansEtapeFiable([vaccination({})], protocole).map((item) => item.vaccin), ["NASALGEN"]);
});

test("une injection liée au protocole mais sans étape reste à vérifier", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ protocoleId: "nasalgen" })], protocole).length, 1);
});

test("une étape réellement reliée est prise en charge par le calcul normal", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ protocoleId: "nasalgen", etapeProtocoleId: "primo" })], protocole).length, 0);
});

test("un autre protocole et un nom voisin ne sont pas confondus avec Nasalgen", () => {
  assert.equal(vaccinationsSansEtapeFiable([
    vaccination({ vaccin: "NASALGEN_RAPPEL" }),
    vaccination({ protocoleId: "autre", medicamentId: "med-nasalgen" }),
    vaccination({ vaccin: "AUTRE", medicamentId: null }),
  ], protocole).length, 0);
});

test("le médicament associé permet de repérer une ancienne saisie avec un autre libellé", () => {
  assert.equal(vaccinationsSansEtapeFiable([vaccination({ vaccin: "Nasalgen 3", medicamentId: "med-nasalgen" })], protocole).length, 1);
});

const etapes = (nom: string) => ({
  id: nom,
  etapes: [
    { id: `${nom}-1`, ordre: 0, cycle: "INITIAL", reference: "NAISSANCE", medicaments: [{ medicament: { id: `med-${nom}`, nom } }] },
    { id: `${nom}-2`, ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE", medicaments: [{ medicament: { id: `med-${nom}`, nom } }] },
  ],
});

test("une seule primo Bovigrip ancienne alimente son rappel sans être confondue avec Nasalgen", () => {
  const bovigrip = vaccination({ vaccin: "BOVILIS BOVIGRIP", medicamentId: null });
  const nasalgen = vaccination({ vaccin: "NASALGEN" });
  const resultat = rattacherPrimoNonLiee([bovigrip, nasalgen], etapes("BOVILIS BOVIGRIP"));
  assert.equal(resultat.rattachee, bovigrip);
  assert.equal(resultat.vaccinations[0].etapeProtocoleId, "BOVILIS BOVIGRIP-1");
  assert.equal(rattacherPrimoNonLiee([bovigrip], etapes("NASALGEN")).rattachee, null);
});

test("Nasalgen et Bovilis Intranasal restent deux injections indépendantes", () => {
  const nasalgen = vaccination({ vaccin: "NASALGEN" });
  const bovilis = vaccination({ vaccin: "BOVILIS INTRANASAL RSP LIVE" });
  assert.equal(rattacherPrimoNonLiee([nasalgen, bovilis], etapes("NASALGEN")).rattachee, nasalgen);
  assert.equal(rattacherPrimoNonLiee([nasalgen, bovilis], etapes("BOVILIS INTRANASAL RSP LIVE")).rattachee, bovilis);
});

test("deux injections non rattachées du même produit et un acte non fait restent à vérifier", () => {
  const p = etapes("BOVILIS BOVIGRIP");
  assert.equal(rattacherPrimoNonLiee([vaccination({ vaccin: p.id }), vaccination({ vaccin: p.id })], p).rattachee, null);
  assert.equal(rattacherPrimoNonLiee([vaccination({ vaccin: p.id, statut: "PREVU" })], p).rattachee, null);
});

test("Bovigrip du 11 septembre produit un rappel le 9 octobre, absent du carnet", () => {
  const p = etapes("BOVILIS BOVIGRIP");
  const debut = vaccination({ date: new Date("2026-09-11T12:00:00Z"), vaccin: p.id });
  const preuve = rattacherPrimoNonLiee([debut], p);
  const action = calculerActionVaccinale({
    date: new Date("2026-09-29T12:00:00Z"),
    dateNaissance: new Date("2026-01-01T12:00:00Z"),
    statutProtocole: null,
    vaccinations: preuve.vaccinations,
    etapes: [
      { id: `${p.id}-1`, label: "Primo", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE", debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 365, finUnite: "JOUR", finPosition: "APRES" },
      { id: `${p.id}-2`, label: "Rappel", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE", debutValeur: 4, debutUnite: "SEMAINE", debutPosition: "APRES", finValeur: 4, finUnite: "SEMAINE", finPosition: "APRES" },
    ],
  });
  assert.equal(action.etape?.id, `${p.id}-2`);
  assert.equal(action.dateMin?.toISOString().slice(0, 10), "2026-10-09");
});

test("rattacherInjectionOrpheline : utilise rattacherPrimoNonLiee quand les deux étapes partagent le médicament", () => {
  const p = etapes("BOVILIS BOVIGRIP");
  const noms = ["BOVILIS BOVIGRIP"];
  const medicamentIds = ["med-BOVILIS BOVIGRIP"];
  const bovigrip = vaccination({ vaccin: "BOVILIS BOVIGRIP" });
  const resultat = rattacherInjectionOrpheline(
    [bovigrip],
    { ...p, noms, medicamentIds },
    { protocoleLieAuVelage: false, medicamentPartage: false }
  );
  assert.equal(resultat, bovigrip);
});

test("rattacherInjectionOrpheline : cas réel Bovigrip — l'étape rappel n'a pas de médicament lié en base, le repli à 1 candidate prend le relais", () => {
  const primo = { id: "bovigrip-primo", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE", medicaments: [{ medicament: { id: "med-bovigrip", nom: "BOVILIS BOVIGRIP" } }] };
  const rappelSansMedicament = { id: "bovigrip-rappel", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE", medicaments: [] };
  const protocoleReel = { id: "proto-bovigrip", noms: ["BOVILIS BOVIGRIP"], medicamentIds: ["med-bovigrip"], etapes: [primo, rappelSansMedicament] };
  const acte = vaccination({ vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip" });

  // rattacherPrimoNonLiee seul échoue (noms[1] vide) : c'est exactement ce que
  // /sanitaire/nouvel-evenement utilisait avant ce correctif, d'où l'incohérence constatée.
  assert.equal(rattacherPrimoNonLiee([acte], protocoleReel).rattachee, null);

  const resultat = rattacherInjectionOrpheline([acte], protocoleReel, { protocoleLieAuVelage: false, medicamentPartage: false });
  assert.equal(resultat, acte);
});

test("rattacherInjectionOrpheline : deux injections orphelines restent ambiguës (pas de rattachement à l'aveugle)", () => {
  const primo = { id: "bovigrip-primo", ordre: 0, cycle: "INITIAL", reference: "NAISSANCE", medicaments: [{ medicament: { id: "med-bovigrip", nom: "BOVILIS BOVIGRIP" } }] };
  const rappelSansMedicament = { id: "bovigrip-rappel", ordre: 1, cycle: "INITIAL", reference: "ETAPE_PRECEDENTE", medicaments: [] };
  const protocoleReel = { id: "proto-bovigrip", noms: ["BOVILIS BOVIGRIP"], medicamentIds: ["med-bovigrip"], etapes: [primo, rappelSansMedicament] };
  const actes = [vaccination({ vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip" }), vaccination({ vaccin: "BOVILIS BOVIGRIP", medicamentId: "med-bovigrip" })];
  assert.equal(rattacherInjectionOrpheline(actes, protocoleReel, { protocoleLieAuVelage: false, medicamentPartage: false }), null);
});

test("rattacherInjectionOrpheline : jamais appliqué à un protocole lié au vêlage ni à un médicament partagé", () => {
  const p = { id: "proto", noms: ["X"], medicamentIds: ["med-x"], etapes: etapes("X").etapes };
  const acte = vaccination({ vaccin: "X", medicamentId: "med-x" });
  assert.equal(rattacherInjectionOrpheline([acte], p, { protocoleLieAuVelage: true, medicamentPartage: false }), null);
  assert.equal(rattacherInjectionOrpheline([acte], p, { protocoleLieAuVelage: false, medicamentPartage: true }), null);
});
