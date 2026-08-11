import { getCategorieMedicament } from "./medicament-categories.ts";
import type {
  ChampExtrait,
  MedicamentCorrespondant,
  MedicamentPropose,
  PropositionOrdonnance,
} from "./ordonnance-types.ts";
import { medicamentVide, medicamentsDepuisProposition } from "./ordonnance-types.ts";
import {
  extraireDateDelivrance,
  extraireDateDerniereVisite,
  extraireDateOrdonnance,
  sourceIndiqueDelivreCeJour,
} from "./ordonnance-dates.ts";

export interface MedicamentCandidat {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  voie: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  actif?: boolean;
  aliases: string[];
}

function texte(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nombre(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function entier(value: unknown): number | null {
  const parsed = nombre(value);
  return parsed === null ? null : Math.max(0, Math.round(parsed));
}

function confiance(value: unknown): number {
  const parsed = nombre(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.min(1, parsed));
}

function champ(value: unknown): ChampExtrait<unknown> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    value: raw.value ?? null,
    sourceText: texte(raw.sourceText),
    confidence: confiance(raw.confidence),
    zone: texte(raw.zone),
  };
}

function preuves(value: unknown): Record<string, ChampExtrait<unknown>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, champ(raw)] as const)
      .filter((entry): entry is [string, ChampExtrait<unknown>] => entry[1] !== null),
  );
}

export function normaliserNomMedicament(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b(SOLUTION|SOL|INJECTABLE|INJ|FLACON|FL|AEROSOL|AER|AMPOULE|AMP|BOITE|BT|COMPRIME|CP|ML|MG|MCG|G|KG|CLAS)\b\.?/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function distanceEdition(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const precedente = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= b.length; j += 1) {
      courante[j] = Math.min(
        courante[j - 1] + 1,
        precedente[j] + 1,
        precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    precedente.splice(0, precedente.length, ...courante);
  }
  return precedente[b.length];
}

function scoreNomProche(nom: string, candidat: string): number {
  const nomCompact = nom.replaceAll(" ", "");
  const candidatCompact = candidat.replaceAll(" ", "");
  if (nomCompact.length < 6 || candidatCompact.length < 6) return 0;
  if (nomCompact === candidatCompact) return 0.98;
  return distanceEdition(nomCompact, candidatCompact) === 1 ? 0.94 : 0;
}

function classerDates(p: Record<string, unknown>): {
  prescriptionDate: string | null;
  lastVisitDate: string | null;
  deliveryDate: string | null;
} {
  let prescriptionDate: string | null = null;
  let lastVisitDate: string | null = null;
  let deliveryDate: string | null = null;
  let scorePrescription = -1;
  let scoreVisite = -1;
  let scoreDelivrance = -1;
  const evidence = preuves(p.evidence);

  const classer = (
    source: string | null | undefined,
    confidence = 0,
  ) => {
    const dateOrdonnance = extraireDateOrdonnance(source);
    const dateVisite = extraireDateDerniereVisite(source);
    const dateDelivrance = extraireDateDelivrance(source);
    const score = 100 + confidence;
    if (dateOrdonnance && score > scorePrescription) {
      prescriptionDate = dateOrdonnance;
      scorePrescription = score;
      return;
    }
    if (dateVisite && score > scoreVisite) {
      lastVisitDate = dateVisite;
      scoreVisite = score;
      return;
    }
    if (dateDelivrance && score > scoreDelivrance) {
      deliveryDate = dateDelivrance;
      scoreDelivrance = score;
    }
  };

  classer(
    evidence.prescriptionDate?.sourceText,
    evidence.prescriptionDate?.confidence,
  );
  classer(evidence.lastVisitDate?.sourceText, evidence.lastVisitDate?.confidence);
  const delivreCeJour = sourceIndiqueDelivreCeJour(evidence.deliveryDate?.sourceText);
  classer(evidence.deliveryDate?.sourceText, evidence.deliveryDate?.confidence);

  if (Array.isArray(p.dateCandidates)) {
    for (const raw of p.dateCandidates) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      const source = texte(candidate.sourceText) ?? "";
      classer(source, nombre(candidate.confidence) ?? 0);
    }
  }
  if (!deliveryDate && prescriptionDate && delivreCeJour) {
    deliveryDate = prescriptionDate;
  }
  return { prescriptionDate, lastVisitDate, deliveryDate };
}

export function trouverMedicament(
  nomExtrait: string | null,
  substanceActive: string | null,
  candidats: MedicamentCandidat[],
): MedicamentCorrespondant | null {
  const matches = trouverCorrespondancesMedicaments(nomExtrait, substanceActive, candidats);
  const premier = matches[0];
  const second = matches[1];
  if (!premier || premier.score < 0.9 || (second && premier.score - second.score < 0.08)) return null;
  return premier;
}

export function trouverCorrespondancesMedicaments(
  nomExtrait: string | null,
  substanceActive: string | null,
  candidats: MedicamentCandidat[],
): MedicamentCorrespondant[] {
  if (!nomExtrait) return [];
  const nom = normaliserNomMedicament(nomExtrait);
  if (!nom) return [];

  const resultats: Array<{ candidat: MedicamentCandidat; score: number }> = [];
  for (const candidat of candidats) {
    const noms = [candidat.nom, ...candidat.aliases].map(normaliserNomMedicament).filter(Boolean);
    const exact = noms.some((item) => item === nom);
    const nomContenu = noms.some((item) => {
      if (item.length < 4) return false;
      return ` ${nom} `.includes(` ${item} `) || ` ${item} `.includes(` ${nom} `);
    });
    const scoreProche = Math.max(...noms.map((item) => scoreNomProche(nom, item)));
    const tokensNom = new Set(nom.split(" "));
    const tokenScore = Math.max(...noms.map((item) => {
      const tokens = item.split(" ").filter(Boolean);
      return tokens.length === 0 ? 0 : tokens.filter((token) => tokensNom.has(token)).length / tokens.length;
    }));
    const dciConcorde = Boolean(
      substanceActive && candidat.dci
      && normaliserNomMedicament(substanceActive).includes(normaliserNomMedicament(candidat.dci)),
    );
    const score = Math.min(1, exact ? 1 : nomContenu ? 0.97 : Math.max(
      scoreProche,
      tokenScore * 0.85 + (dciConcorde ? 0.15 : 0),
    ));
    if (score >= 0.72) resultats.push({ candidat, score });
  }
  return resultats
    .sort((a, b) => b.score - a.score || a.candidat.nom.localeCompare(b.candidat.nom, "fr"))
    .map(({ candidat, score }) => ({
      id: candidat.id,
      nom: candidat.nom,
      dci: candidat.dci,
      forme: candidat.forme,
      categorie: candidat.categorie,
      categorieLabel: getCategorieMedicament(candidat.categorie).label,
      voie: candidat.voie,
      delaiAttenteViandeJ: candidat.delaiAttenteViandeJ,
      delaiAttenteLaitJ: candidat.delaiAttenteLaitJ,
      actif: candidat.actif !== false,
      score,
      concordances: [],
      divergences: [],
    }));
}

function evaluerCorrespondance(
  proposition: MedicamentPropose,
  candidats: MedicamentCandidat[],
): MedicamentPropose {
  const matches = trouverCorrespondancesMedicaments(
    proposition.medicamentNom,
    proposition.substanceActive,
    candidats,
  ).map((match) => comparerAvecReference(proposition, match));
  const match = trouverMedicament(proposition.medicamentNom, proposition.substanceActive, candidats);
  return {
    ...proposition,
    medicationMatch: match ? comparerAvecReference(proposition, match) : null,
    medicationMatches: matches,
    medicationMatchStatus: match ? "matched" : matches.length > 0 ? "ambiguous" : "unmatched",
  };
}

export function reevaluerCorrespondancesOrdonnance(
  proposition: PropositionOrdonnance,
  candidats: MedicamentCandidat[],
): PropositionOrdonnance {
  const medicaments = medicamentsDepuisProposition(proposition);
  return {
    ...proposition,
    medicaments: medicaments.map((medicament) => {
      if (medicament.medicationMatchStatus === "matched" || medicament.medicationMatchStatus === "manually_confirmed") {
        return medicament;
      }
      return evaluerCorrespondance(medicament, candidats);
    }),
  };
}

export function comparerAvecReference(
  medicament: MedicamentPropose,
  match: MedicamentCorrespondant,
): MedicamentCorrespondant {
  const concordances: string[] = [];
  const divergences: string[] = [];
  const comparer = (label: string, extrait: string | number | null, reference: string | number | null) => {
    if (extrait == null || reference == null) return;
    const identique = typeof extrait === "string" && typeof reference === "string"
      ? normaliserNomMedicament(extrait) === normaliserNomMedicament(reference)
      : extrait === reference;
    (identique ? concordances : divergences).push(label);
  };
  comparer("substance active", medicament.substanceActive, match.dci);
  comparer("voie", medicament.voie, match.voie);
  comparer("delai viande", medicament.withdrawalPeriods.meatDays, match.delaiAttenteViandeJ);
  comparer("delai lait", medicament.withdrawalPeriods.milkDays, match.delaiAttenteLaitJ);
  return { ...match, concordances, divergences };
}

export function normaliserAnalyseOrdonnance(
  parsed: Record<string, unknown> | null | undefined,
  candidats: MedicamentCandidat[] = [],
): PropositionOrdonnance {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const datesClassees = classerDates(p);
  const medicamentsBruts = Array.isArray(p.medicaments) ? p.medicaments : [p];

  const medicaments = medicamentsBruts.map((raw) => {
    const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const dose = (m.dose && typeof m.dose === "object" ? m.dose : m) as Record<string, unknown>;
    const protocole = (m.administrationProtocol && typeof m.administrationProtocol === "object"
      ? m.administrationProtocol : m) as Record<string, unknown>;
    const delais = (m.withdrawalPeriods && typeof m.withdrawalPeriods === "object"
      ? m.withdrawalPeriods : m) as Record<string, unknown>;
    const proposition: MedicamentPropose = {
      ...medicamentVide(),
      medicamentNom: texte(m.medicamentNom),
      numeroLot: texte(m.numeroLot),
      substanceActive: texte(m.substanceActive),
      concentration: texte(m.concentration),
      categorie: texte(m.categorie),
      familleTherapeutique: texte(m.familleTherapeutique),
      formePharmaceutique: texte(m.formePharmaceutique),
      conditionnement: texte(m.conditionnement),
      voie: texte(m.voie),
      doseValue: nombre(dose.doseValue ?? m.dose),
      doseUnit: texte(dose.doseUnit ?? m.uniteDosage),
      referenceValue: nombre(dose.referenceValue),
      referenceUnit: texte(dose.referenceUnit),
      referenceType: dose.referenceType === "live_weight" || dose.referenceType === "animal"
        ? dose.referenceType : null,
      normalizedDoseValue: nombre(dose.normalizedDoseValue),
      normalizedDoseUnit: texte(dose.normalizedDoseUnit),
      administrationCount: entier(protocole.administrationCount),
      administrationIntervalHours: entier(protocole.administrationIntervalHours),
      treatmentDurationDays: entier(protocole.treatmentDurationDays ?? m.dureeJours),
      repeatCondition: texte(protocole.repeatCondition),
      administrationInstructions: texte(protocole.administrationInstructions ?? m.frequence),
      withdrawalPeriods: {
        meatDays: entier(delais.meatDays ?? m.delaiAttenteViandeJ),
        offalDays: entier(delais.offalDays ?? m.delaiAttenteViandeJ),
        milkDays: entier(delais.milkDays ?? m.delaiAttenteLaitJ),
      },
      precautions: texte(m.precautions),
      medicationMatch: null,
      evidence: preuves(m.evidence),
    };
    return evaluerCorrespondance(proposition, candidats);
  }).filter((m) => m.medicamentNom || m.doseValue || m.numeroLot);

  return {
    prescriptionDate: datesClassees.prescriptionDate,
    lastVisitDate: datesClassees.lastVisitDate,
    deliveryDate: datesClassees.deliveryDate,
    ordonnanceNumero: texte(p.ordonnanceNumero),
    veterinaire: texte(p.veterinaire),
    motif: texte(p.motif),
    medicaments: medicaments.length > 0 ? medicaments : [medicamentVide()],
    evidence: preuves(p.evidence),
  };
}
