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

test("sans acte ni statut, un questionnaire Primo/Rappel démarre par la Primo", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "SANS_REGLE" }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "p-im", preconisationRappelId: "p-im", resterDansFenetrePrimo: false } };
  const resultat = action(configuration, { statutProtocole: null });
  assert.equal(resultat.statut, "A_FAIRE");
  assert.equal(resultat.etape?.id, "primo");
  assert.equal(iso(resultat.dateMin), "2026-03-01");
});

test("sans acte ni statut, une dose unique suit son calendrier", () => {
  const resultat = action(base(), { statutProtocole: null });
  assert.equal(resultat.statut, "A_FAIRE");
  assert.equal(resultat.etape?.id, "dose");
});

test("sans historique, l'âge minimum diffère puis ouvre la première étape", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "AGE_MINIMUM", age: { valeur: 60, unite: "JOUR" } }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "p-im", preconisationRappelId: "p-im", resterDansFenetrePrimo: false } };
  const tropJeune = action(configuration, { date: jour("2026-01-10"), statutProtocole: null });
  assert.equal(tropJeune.statut, "TROP_TOT");
  assert.equal(tropJeune.etape?.id, "primo");
  assert.equal(iso(tropJeune.dateMin), "2026-03-02");
  const ageAtteint = action(configuration, { date: jour("2026-03-03"), statutProtocole: null });
  assert.equal(ageAtteint.statut, "A_FAIRE");
  assert.equal(ageAtteint.etape?.id, "primo");
});

test("sans date de vêlage le parcours pré-vêlage reste à confirmer, avec date il respecte la fenêtre", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "AVANT_VELAGE", debutAvant: { valeur: 90, unite: "JOUR" }, finAvant: { valeur: 30, unite: "JOUR" } }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "p-im", preconisationRappelId: "p-im", resterDansFenetrePrimo: false } };
  assert.equal(action(configuration, { statutProtocole: null, dateVelagePrevue: null }).statut, "A_CONFIRMER");
  const prevu = action(configuration, { statutProtocole: null, date: jour("2026-08-01"), dateVelagePrevue: jour("2026-12-01") });
  assert.equal(prevu.etape?.id, "primo");
  assert.equal(iso(prevu.dateMin), "2026-09-02");
  assert.equal(prevu.statut, "TROP_TOT");
  const ouvert = action(configuration, { statutProtocole: null, date: jour("2026-09-15"), dateVelagePrevue: jour("2026-12-01") });
  assert.equal(ouvert.statut, "A_FAIRE");
  assert.equal(iso(ouvert.dateMax), "2026-11-01");
});

test("sans historique, les mois annuels restent la source de la première fenêtre", () => {
  const configuration = base();
  configuration.demarrage = { type: "DOSE_UNIQUE", etapeDoseId: "dose", preconisationId: "p-im", calendrier: { type: "MOIS_ANNUELS", mois: [10] } };
  const resultat = action(configuration, { statutProtocole: null, date: jour("2026-03-01") });
  assert.equal(resultat.etape?.id, "dose");
  assert.equal(iso(resultat.dateMin), "2026-10-01");
  assert.equal(resultat.statut, "TROP_TOT");
});

test("l'incertitude réelle demeure : configuration invalide et statut explicite à confirmer", () => {
  assert.equal(action(base(), { statutProtocole: "A_CONFIRMER" }).statut, "A_CONFIRMER");
  const invalide = action(base(), { statutProtocole: null, configurationQuestionnaireJson: "{invalide" });
  assert.equal(invalide.statut, "A_CONFIRMER");
  assert.equal(invalide.etape, null);
});

test("une Primo réelle sans statut conduit au Rappel ; un protocole acquis ne redémarre pas", () => {
  const configuration = base();
  configuration.demarrage = { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "SANS_REGLE" }, rappel: { type: "DELAI_FIXE", delai: { valeur: 21, unite: "JOUR" }, preconisationPrimoId: "p-im", preconisationRappelId: "p-im", resterDansFenetrePrimo: false } };
  const rappel = action(configuration, { statutProtocole: null, vaccinations: [{ date: jour("2026-02-20"), etapeProtocoleId: "primo" }] });
  assert.equal(rappel.etape?.id, "rappel");
  assert.equal(iso(rappel.dateMin), "2026-03-13");
  const acquis = action(configuration, { statutProtocole: "PROTOCOLE_ACQUIS" });
  assert.equal(acquis.statut, "TERMINE");
  assert.equal(acquis.etape, null);
});

test("la limite facultative du programme ne touche pas les anciens protocoles v1", () => {
  const config = base();
  assert.deepEqual(lireConfigurationQuestionnaire(JSON.stringify(config)), config);
  assert.equal(action(config).statut, "A_FAIRE", "sans seuil explicite, la recommandation reste inchangée");
});

test("age maximal : à la date limite la Primo reste possible, le lendemain elle sort du programme", () => {
  const cfg: ConfigurationQuestionnaireV1 = {
    ...base(), ageMaxDemarrage: { valeur: 30, unite: "JOUR" },
  };
  assert.equal(action(cfg, { date: jour("2026-01-31") }).statut, "A_FAIRE");
  const horsProgramme = action(cfg, { date: jour("2026-02-01") });
  assert.equal(horsProgramme.statut, "HORS_PROGRAMME");
  assert.equal(horsProgramme.etape?.id, "dose");
  assert.equal(horsProgramme.dateMin, null, "une échéance hors programme ne crée pas de date fictive");
});

test("la limite facultative du programme ne supprime jamais le rappel après une Primo faite", () => {
  const cfg: ConfigurationQuestionnaireV1 = {
    ...base(),
    ageMaxDemarrage: { valeur: 30, unite: "JOUR" },
    demarrage: { type: "PRIMO_RAPPEL", etapePrimoId: "primo", etapeRappelId: "rappel", calendrierPrimo: { type: "SANS_REGLE" },
      rappel: { type: "DELAI_FIXE", delai: { valeur: 28, unite: "JOUR" }, preconisationPrimoId: "p-im", preconisationRappelId: "p-im", resterDansFenetrePrimo: false },
    },
  };
  const actionRappel = action(cfg, {
    date: jour("2026-03-01"),
    vaccinations: [{ date: jour("2026-01-15"), etapeProtocoleId: "primo" }],
    statutProtocole: "PRIMO_EN_COURS",
  });
  assert.equal(actionRappel.etape?.id, "rappel");
  assert.equal(actionRappel.statut, "EN_RETARD");
  assert.equal(action(cfg, { date: jour("2026-03-01") }).statut, "HORS_PROGRAMME");
});

test("l'age maximal de demarrage invalide ou applique au velage est refuse", () => {
  const cfg: ConfigurationQuestionnaireV1 = { ...base(), ageMaxDemarrage: { valeur: 30, unite: "JOUR" } };
  const invalidAge = { ...cfg, ageMaxDemarrage: { valeur: -1, unite: "JOUR" } };
  assert.equal(lireConfigurationQuestionnaire(JSON.stringify(invalidAge)), null);
  const avantVelage = { ...cfg, demarrage: { type: "DOSE_UNIQUE", etapeDoseId: "dose", preconisationId: "p-im",
    calendrier: { type: "AVANT_VELAGE", debutAvant: { valeur: 3, unite: "MOIS" }, finAvant: { valeur: 3, unite: "SEMAINE" } },
  } };
  assert.equal(lireConfigurationQuestionnaire(JSON.stringify(avantVelage)), null);
  const minPlusGrand = { ...cfg, demarrage: { type: "DOSE_UNIQUE", etapeDoseId: "dose", preconisationId: "p-im",
    calendrier: { type: "AGE_MINIMUM", age: { valeur: 2, unite: "MOIS" } },
  } };
  assert.equal(lireConfigurationQuestionnaire(JSON.stringify(minPlusGrand)), null);
});

test("la limite d'age ne reclasse pas un historique ambigu en hors programme", () => {
  const cfg: ConfigurationQuestionnaireV1 = { ...base(), ageMaxDemarrage: { valeur: 30, unite: "JOUR" } };
  assert.equal(action(cfg, { statutProtocole: "A_CONFIRMER" }).statut, "A_CONFIRMER");
});
