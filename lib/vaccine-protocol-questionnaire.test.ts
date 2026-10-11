import assert from "node:assert/strict";
import test from "node:test";
import { calculerActionVaccinale, type EtapeVaccinaleConfig } from "./vaccine-planner.ts";
import { brancheInitialeDepuisActes, choisirBrancheAgePrimo, lireConfigurationQuestionnaire, preconisationAutomatique, type ConfigurationQuestionnaireV1 } from "./vaccine-protocol-questionnaire.ts";

const jour = (value: string) => new Date(`${value}T12:00:00Z`);
const iso = (value: Date | null) => value?.toISOString().slice(0, 10);
const etape = (id: string, ordre: number, cycle = "INITIAL"): EtapeVaccinaleConfig => ({ id, label: id, ordre, cycle, reference: "NAISSANCE", debutValeur: 0, debutUnite: "JOUR", debutPosition: "APRES", finValeur: 0, finUnite: "JOUR", finPosition: "APRES", obligatoire: true });
const base = (): ConfigurationQuestionnaireV1 => ({
  version: 1, medicamentId: "med", cible: { tousBovins: true, categories: [] },
  demarrage: { type: "DOSE_UNIQUE", etapeDoseId: "dose", preconisationId: "p-im", calendrier: { type: "SANS_REGLE" } },
  entretien: { actif: false },
});
const action = (configuration: ConfigurationQuestionnaireV1, extra: Partial<Parameters<typeof calculerActionVaccinale>[0]> = {}) => calculerActionVaccinale({
  date: jour("2026-03-01"), dateNaissance: jour("2026-01-01"), etapes: [etape("dose", 0), etape("primo", 0), etape("rappel", 1), etape("entretien", 2, "ENTRETIEN")], vaccinations: [], statutProtocole: "PRIMO_A_FAIRE", configurationQuestionnaireJson: JSON.stringify(configuration), ...extra,
});

test("JSON null conserve exactement le calcul legacy", () => {
  const args = { date: jour("2026-01-01"), dateNaissance: jour("2026-01-01"), etapes: [etape("dose", 0)], vaccinations: [], statutProtocole: "PRIMO_A_FAIRE" as const };
  assert.deepEqual(calculerActionVaccinale(args), calculerActionVaccinale({ ...args, configurationQuestionnaireJson: null }));
});

test("la Pharmacie choisit automatiquement une seule préconisation mais jamais parmi plusieurs", () => {
  assert.equal(preconisationAutomatique([{ id: "p-unique" }]), "p-unique");
  assert.equal(preconisationAutomatique([{ id: "p-im" }, { id: "p-in" }]), null);
  assert.equal(preconisationAutomatique([]), null);
});

test("un protocole questionnaire présent utilise sa règle et pas les champs legacy", () => {
  const configuration = base();
  assert.equal(configuration.demarrage.type, "DOSE_UNIQUE");
  if (configuration.demarrage.type !== "DOSE_UNIQUE") return;
  configuration.demarrage = { ...configuration.demarrage, calendrier: { type: "AGE_MINIMUM", age: { valeur: 2, unite: "MOIS" } } };
  const resultat = action(configuration, { date: jour("2026-01-15"), etapes: [{ ...etape("dose", 0), debutValeur: 500, finValeur: 500 }] });
  assert.equal(iso(resultat.dateMin), "2026-03-01");
  assert.equal(resultat.statut, "TROP_TOT");
});

test("dose unique sans entretien se termine après la dose", () => {
  const resultat = action(base(), { vaccinations: [{ date: jour("2026-02-01"), etapeProtocoleId: "dose" }], statutProtocole: "PROTOCOLE_ACQUIS" });
  assert.equal(resultat.statut, "TERMINE");
});

test("dose unique puis entretien utilise le premier délai", () => {
  const configuration = base();
  configuration.entretien = { actif: true, etapeId: "entretien", preconisationId: "p-im", calendrier: { type: "APRES_DELAI", premierDelai: { valeur: 6, unite: "MOIS" }, recurrence: { valeur: 6, unite: "MOIS" } } };
  const resultat = action(configuration, { vaccinations: [{ date: jour("2026-02-01"), etapeProtocoleId: "dose" }], statutProtocole: "PROTOCOLE_ACQUIS" });
  assert.equal(resultat.etape?.id, "entretien");
  assert.equal(iso(resultat.dateMin), "2026-08-01");
});

test("Primo et Rappel utilisent le délai configuré", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "SANS_REGLE" }, rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "p-in", preconisationRappelId: "p-im", resterDansFenetrePrimo: false } };
  const resultat = action(configuration, { date: jour("2026-02-28"), vaccinations: [{ date: jour("2026-02-01"), etapeProtocoleId: "primo" }], statutProtocole: "PRIMO_EN_COURS" });
  assert.equal(resultat.etape?.id, "rappel");
  assert.equal(iso(resultat.dateMin), "2026-03-01");
});

test("la fenêtre de Primo est raccourcie pour que le Rappel reste avant vêlage", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } }, rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "p", preconisationRappelId: "p", resterDansFenetrePrimo: true } };
  const resultat = action(configuration, { date: jour("2026-09-01"), dateVelagePrevue: jour("2026-12-01") });
  assert.equal(iso(resultat.dateMax), "2026-10-13");
});

function conditionnel(): ConfigurationQuestionnaireV1 {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "AGE_MINIMUM", age: { valeur: 0, unite: "JOUR" } }, rappel: { type: "BRANCHES_AGE_PRIMO", seuilAgePrimo: { valeur: 2.5, unite: "MOIS" }, resterDansFenetrePrimo: false, branches: [
    { id: "avant", position: "AVANT_SEUIL", preconisationPrimoId: "p-in", delaiRappel: { valeur: 8, unite: "SEMAINE" }, preconisationRappelId: "p-im" },
    { id: "apres", position: "A_PARTIR_SEUIL", preconisationPrimoId: "p-im", delaiRappel: { valeur: 4, unite: "SEMAINE" }, preconisationRappelId: "p-im" },
  ] } };
  return configuration;
}

test("la branche choisie à la Primo reste utilisée après franchissement du seuil", () => {
  const configuration = conditionnel();
  const datePrimo = jour("2026-03-01");
  assert.equal(choisirBrancheAgePrimo(configuration, jour("2026-01-01"), datePrimo)?.id, "avant");
  const resultat = action(configuration, { date: jour("2026-04-26"), vaccinations: [{ date: datePrimo, etapeProtocoleId: "primo" }], statutProtocole: "PRIMO_EN_COURS", brancheInitialeId: "avant" });
  assert.equal(iso(resultat.dateMin), "2026-04-26");
  assert.equal(resultat.preconisationId, "p-im");
});

test("une Primo après le seuil choisit l'autre branche", () => {
  assert.equal(choisirBrancheAgePrimo(conditionnel(), jour("2026-01-01"), jour("2026-04-01"))?.id, "apres");
  assert.equal(action(conditionnel(), { date: jour("2026-04-01") }).preconisationId, "p-im");
});

test("suppression ou déplacement de Primo recalcule la branche depuis les actes réels", () => {
  const configuration = conditionnel();
  assert.equal(brancheInitialeDepuisActes(configuration, jour("2026-01-01"), []), null);
  assert.equal(brancheInitialeDepuisActes(configuration, jour("2026-01-01"), [{ etapeProtocoleId: "primo", date: jour("2026-04-01") }]), "apres");
});

test("plusieurs mois annuels restent sélectionnés et produisent la prochaine fenêtre", () => {
  const configuration = base();
  assert.equal(configuration.demarrage.type, "DOSE_UNIQUE");
  if (configuration.demarrage.type !== "DOSE_UNIQUE") return;
  configuration.demarrage = { ...configuration.demarrage, calendrier: { type: "MOIS_ANNUELS", mois: [2, 5, 10] } };
  const resultat = action(configuration, { date: jour("2026-03-01") });
  assert.equal(iso(resultat.dateMin), "2026-05-01");
  assert.deepEqual(lireConfigurationQuestionnaire(JSON.stringify(configuration))?.demarrage, configuration.demarrage);
});

test("premier entretien à 6 mois puis récurrence distincte à 12 mois", () => {
  const configuration = base();
  configuration.entretien = { actif: true, etapeId: "entretien", preconisationId: "p", calendrier: { type: "APRES_DELAI", premierDelai: { valeur: 6, unite: "MOIS" }, recurrence: { valeur: 12, unite: "MOIS" } } };
  const premier = action(configuration, { vaccinations: [{ date: jour("2026-01-01"), etapeProtocoleId: "dose" }], statutProtocole: "PROTOCOLE_ACQUIS" });
  const suivant = action(configuration, { vaccinations: [{ date: jour("2026-01-01"), etapeProtocoleId: "dose" }, { date: jour("2026-07-01"), etapeProtocoleId: "entretien" }], statutProtocole: "PROTOCOLE_ACQUIS" });
  assert.equal(iso(premier.dateMin), "2026-07-01");
  assert.equal(iso(suivant.dateMin), "2027-07-01");
});

function protocoleGestationAvecEntretien(): ConfigurationQuestionnaireV1 {
  const fenetre = { type: "AVANT_VELAGE" as const, debutAvant: { valeur: 3, unite: "MOIS" as const }, finAvant: { valeur: 3, unite: "SEMAINE" as const } };
  return {
    version: 1,
    medicamentId: "med-cryptium",
    cible: { tousBovins: false, categories: ["GENISSE", "VACHE"] },
    demarrage: {
      type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: fenetre,
      rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "p", preconisationRappelId: "p", resterDansFenetrePrimo: true },
    },
    entretien: { actif: true, etapeId: "entretien", preconisationId: "p", calendrier: fenetre },
  };
}

test("un entretien historique acquiert l'initial mais ne couvre pas la nouvelle gestation", () => {
  const ancienEntretien = { date: jour("2025-09-01"), etapeProtocoleId: "entretien" };
  const resultat = action(protocoleGestationAvecEntretien(), {
    date: jour("2026-09-01"), dateVelagePrevue: jour("2026-12-01"),
    vaccinations: [], historiqueVaccinations: [ancienEntretien], statutProtocole: "PRIMO_A_FAIRE",
  });
  assert.equal(resultat.etape?.id, "entretien");
  assert.equal(iso(resultat.dateMin), "2026-09-02");
});

test("un entretien du cycle courant acquiert l'initial et couvre seulement ce cycle", () => {
  const entretienCourant = { date: jour("2026-09-01"), etapeProtocoleId: "entretien" };
  const resultat = action(protocoleGestationAvecEntretien(), {
    date: jour("2026-09-01"), dateVelagePrevue: jour("2026-12-01"),
    vaccinations: [entretienCourant], historiqueVaccinations: [entretienCourant], statutProtocole: "PRIMO_A_FAIRE",
  });
  assert.equal(resultat.statut, "TERMINE");
  assert.equal(resultat.etape, null);
});

test("sans acte l'initial commence par la Primo, puis une Primo seule attend le Rappel", () => {
  const configuration = protocoleGestationAvecEntretien();
  const sansActe = action(configuration, { date: jour("2026-09-01"), dateVelagePrevue: jour("2026-12-01"), vaccinations: [], historiqueVaccinations: [], statutProtocole: "PRIMO_A_FAIRE" });
  assert.equal(sansActe.etape?.id, "primo");
  const primo = { date: jour("2026-09-01"), etapeProtocoleId: "primo" };
  const enCours = action(configuration, { date: jour("2026-09-29"), dateVelagePrevue: jour("2026-12-01"), vaccinations: [primo], historiqueVaccinations: [primo], statutProtocole: "PRIMO_EN_COURS" });
  assert.equal(enCours.etape?.id, "rappel");
});
