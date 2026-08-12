import { getCategorieMedicament } from "./medicament-categories.ts";
import type {
  ChampExtrait,
  MedicamentCorrespondant,
  MedicamentPropose,
  PropositionOrdonnance,
} from "./ordonnance-types.ts";
import { medicamentVide, medicamentsDepuisProposition } from "./ordonnance-types.ts";
import {
  dateIsoValide,
  extraireDateDelivrance,
  extraireDateDerniereVisite,
  extraireDateOrdonnance,
  sourceIndiqueDelivreCeJour,
} from "./ordonnance-dates.ts";
import { resoudreSourcesDose, type DoseSourceStructuree } from "./ordonnance-dose-sources.ts";
import {
  normaliserConditionnementExtrait,
  normaliserConditionRenouvellement,
} from "./ordonnance-display.ts";

export interface MedicamentCandidat {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  voie: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  dosagePourKg?: number | null;
  uniteDosage?: string | null;
  preconisations?: Array<{
    dose: number | null;
    unite: string | null;
    doseBase: string | null;
    voie: string | null;
    frequence: string | null;
    delaiAttenteViandeJ: number | null;
    delaiAttenteLaitTraites: number | null;
    statut: string;
  }>;
  conditionnements?: Array<{ quantiteFlacon: number | null; uniteFlacon: string | null }>;
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

function objet(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function collecterTextesSources(value: unknown, profondeur = 0): string[] {
  if (!value || typeof value !== "object" || profondeur > 5) return [];
  const resultats: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "sourceText" && typeof child === "string" && child.trim()) {
      resultats.push(child.trim());
    } else if (child && typeof child === "object") {
      resultats.push(...collecterTextesSources(child, profondeur + 1));
    }
  }
  return [...new Set(resultats)];
}

export function extraireDelaisAttente(sourceTexts: string[]): {
  meatDays: number | null;
  offalDays: number | null;
  milkDays: number | null;
} {
  let meatDays: number | null = null;
  let offalDays: number | null = null;
  let milkDays: number | null = null;
  for (const sourceText of sourceTexts) {
    const source = sourceText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const viandeEtAbats = source.match(
      /\bviande\s+(?:et|&)\s+abats?\s*[:=\-]?\s*(\d{1,3})\s*(?:j|jour|jours)\b/i,
    );
    if (viandeEtAbats) {
      meatDays = Number(viandeEtAbats[1]);
      offalDays = Number(viandeEtAbats[1]);
    }
    for (const match of source.matchAll(
      /\b(viande|abats?|lait)\b\s*[:=\-]?\s*(\d{1,3})\s*(?:j|jour|jours)\b/gi,
    )) {
      const valeur = Number(match[2]);
      if (match[1] === "viande") meatDays = valeur;
      else if (match[1].startsWith("abat")) offalDays = valeur;
      else milkDays = valeur;
    }
  }
  return { meatDays, offalDays, milkDays };
}

function extraireConditionRenouvellement(value: unknown, sourceTexts: string[]): string | null {
  for (const candidate of [texte(value), ...sourceTexts]) {
    const condition = normaliserConditionRenouvellement(candidate);
    if (condition) return condition;
  }
  return null;
}

function doseSource(value: unknown): DoseSourceStructuree | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const doseValue = nombre(raw.doseValue);
  const doseUnit = texte(raw.doseUnit);
  if (doseValue === null || !doseUnit) return null;
  const referenceValue = nombre(raw.referenceValue);
  const referenceUnit = texte(raw.referenceUnit);
  return {
    doseValue: String(doseValue),
    doseUnit,
    referenceValue: referenceValue === null ? "" : String(referenceValue),
    referenceUnit: referenceUnit ?? "",
    referenceType: raw.referenceType === "live_weight" || raw.referenceType === "animal"
      ? raw.referenceType : "",
    sourceText: texte(raw.sourceText),
  };
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
  const dates = objet(p.dates);

  const sourcePrescription = evidence.prescriptionDate?.sourceText;
  const sourcePrescriptionContradictoire = Boolean(
    extraireDateDerniereVisite(sourcePrescription) && !extraireDateOrdonnance(sourcePrescription),
  );
  if (!sourcePrescriptionContradictoire) {
    prescriptionDate = dateIsoValide(evidence.prescriptionDate?.value)
      ?? dateIsoValide(dates.prescriptionDate);
    if (prescriptionDate) scorePrescription = 10;
  }
  lastVisitDate = dateIsoValide(evidence.lastVisitDate?.value)
    ?? dateIsoValide(dates.lastVisitDate);
  if (lastVisitDate) scoreVisite = 10;

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
    }
    if (dateVisite && score > scoreVisite) {
      lastVisitDate = dateVisite;
      scoreVisite = score;
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

function normaliserDoseSource(dose: DoseSourceStructuree | null): {
  value: number;
  unit: string;
} | null {
  if (!dose?.doseValue || !dose.doseUnit || dose.referenceUnit.toLowerCase() !== "kg") return null;
  const valeur = Number(dose.doseValue.replace(",", "."));
  const reference = Number((dose.referenceValue || "1").replace(",", "."));
  if (!Number.isFinite(valeur) || !Number.isFinite(reference) || reference <= 0) return null;
  return { value: valeur / reference, unit: `${dose.doseUnit}/kg` };
}

function nombreAdministrationsCertain({
  administrationCount,
  administrationIntervalHours,
  repeatCondition,
  sourceTexts,
}: {
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  repeatCondition: string | null;
  sourceTexts: string[];
}): number | null {
  if (administrationCount !== 2 || !administrationIntervalHours || !repeatCondition) {
    return administrationCount;
  }
  const normaliser = (value: string) => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const condition = normaliser(repeatCondition);
  const conditionnelle = /\b(si|si necessaire|si besoin|en cas|eventuellement|facultati|peut|pourra)\b/.test(condition);
  const preuveRenouvellement = sourceTexts.some((source) => {
    const texteSource = normaliser(source);
    return /\b(deuxieme|seconde|2e|2eme|renouvel|repeter|nouvelle administration)\b/.test(texteSource)
      && /\b(si|si necessaire|si besoin|en cas|eventuellement|facultati|peut|pourra)\b/.test(texteSource);
  });
  return conditionnelle && preuveRenouvellement ? 1 : administrationCount;
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
      dosagePourKg: candidat.dosagePourKg ?? null,
      uniteDosage: candidat.uniteDosage ?? null,
      preconisations: candidat.preconisations ?? [],
      conditionnements: candidat.conditionnements ?? [],
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
        const candidat = candidats.find((item) => item.id === medicament.medicationMatch?.id);
        if (!candidat || !medicament.medicationMatch) return medicament;
        const matchEnrichi = comparerAvecReference(medicament, {
          ...medicament.medicationMatch,
          dosagePourKg: candidat.dosagePourKg ?? null,
          uniteDosage: candidat.uniteDosage ?? null,
          preconisations: candidat.preconisations ?? [],
          conditionnements: candidat.conditionnements ?? [],
          actif: candidat.actif !== false,
        });
        return {
          ...medicament,
          medicationMatch: matchEnrichi,
          medicationMatches: medicament.medicationMatches.map((match) => (
            match.id === matchEnrichi.id ? matchEnrichi : match
          )),
        };
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
    const evidenceMedicament = preuves(m.evidence);
    const textesSourcesMedicament = collecterTextesSources(m);
    const presentation = objet(m.presentation);
    const textesPresentation = [
      texte(m.medicamentNom),
      evidenceMedicament.conditionnement?.sourceText,
      evidenceMedicament.presentation?.sourceText,
      evidenceMedicament.deliveredQuantity?.sourceText,
      typeof presentation.sourceText === "string" ? presentation.sourceText : null,
    ].filter((value): value is string => Boolean(value));
    const administrationCountBrut = entier(protocole.administrationCount);
    const administrationIntervalHours = entier(protocole.administrationIntervalHours);
    const repeatCondition = extraireConditionRenouvellement(
      protocole.repeatCondition,
      textesSourcesMedicament,
    );
    const delaisSources = extraireDelaisAttente(textesSourcesMedicament);
    const proposition: MedicamentPropose = {
      ...medicamentVide(),
      medicamentNom: texte(m.medicamentNom),
      numeroLot: texte(m.numeroLot),
      substanceActive: texte(m.substanceActive),
      concentration: texte(m.concentration),
      categorie: texte(m.categorie),
      familleTherapeutique: texte(m.familleTherapeutique),
      formePharmaceutique: texte(m.formePharmaceutique),
      conditionnement: normaliserConditionnementExtrait({
        conditionnement: texte(m.conditionnement),
        presentation,
        sourceTexts: textesPresentation,
      }),
      voie: texte(m.voie),
      doseValue: nombre(dose.doseValue ?? m.dose),
      doseUnit: texte(dose.doseUnit ?? m.uniteDosage),
      referenceValue: nombre(dose.referenceValue),
      referenceUnit: texte(dose.referenceUnit),
      referenceType: dose.referenceType === "live_weight" || dose.referenceType === "animal"
        ? dose.referenceType : null,
      normalizedDoseValue: null,
      normalizedDoseUnit: null,
      administrationCount: nombreAdministrationsCertain({
        administrationCount: administrationCountBrut,
        administrationIntervalHours,
        repeatCondition,
        sourceTexts: textesSourcesMedicament,
      }),
      administrationIntervalHours,
      treatmentDurationDays: entier(protocole.treatmentDurationDays ?? m.dureeJours),
      repeatCondition,
      administrationInstructions: texte(protocole.administrationInstructions ?? m.frequence),
      withdrawalPeriods: {
        meatDays: delaisSources.meatDays ?? entier(delais.meatDays ?? m.delaiAttenteViandeJ),
        offalDays: delaisSources.offalDays ?? entier(delais.offalDays ?? m.delaiAttenteViandeJ),
        milkDays: delaisSources.milkDays ?? entier(delais.milkDays ?? m.delaiAttenteLaitJ),
      },
      precautions: texte(m.precautions),
      medicationMatch: null,
      evidence: evidenceMedicament,
    };
    const resolutionDose = resoudreSourcesDose({
      doseValue: proposition.doseValue === null ? "" : String(proposition.doseValue),
      doseUnit: proposition.doseUnit ?? "",
      referenceValue: proposition.referenceValue === null ? "" : String(proposition.referenceValue),
      referenceUnit: proposition.referenceUnit ?? "",
      referenceType: proposition.referenceType ?? "",
      doseSourceText: proposition.evidence.dose?.sourceText,
      doseSourceTexts: textesSourcesMedicament,
      dosePratique: doseSource(m.dosePratique),
      dosePharmacologique: doseSource(m.dosePharmacologique),
    });
    const doseRetenue = resolutionDose.doseAffichee;
    const doseNormalisee = normaliserDoseSource(
      resolutionDose.dosePharmacologique ?? resolutionDose.dosePratique ?? doseRetenue,
    );
    const confianceDose = proposition.evidence.dose?.confidence ?? 0;
    const evidence = {
      ...proposition.evidence,
      ...(resolutionDose.dosePratique ? {
        dosePratique: {
          value: resolutionDose.dosePratique,
          sourceText: resolutionDose.dosePratique.sourceText,
          confidence: confianceDose,
        },
      } : {}),
      ...(resolutionDose.dosePharmacologique ? {
        dosePharmacologique: {
          value: resolutionDose.dosePharmacologique,
          sourceText: resolutionDose.dosePharmacologique.sourceText,
          confidence: confianceDose,
        },
      } : {}),
    };
    return evaluerCorrespondance({
      ...proposition,
      doseValue: doseRetenue ? nombre(doseRetenue.doseValue) : null,
      doseUnit: doseRetenue?.doseUnit ?? null,
      referenceValue: doseRetenue ? nombre(doseRetenue.referenceValue) : null,
      referenceUnit: doseRetenue?.referenceUnit || null,
      referenceType: doseRetenue?.referenceType === "live_weight" || doseRetenue?.referenceType === "animal"
        ? doseRetenue.referenceType : null,
      normalizedDoseValue: doseNormalisee?.value ?? null,
      normalizedDoseUnit: doseNormalisee?.unit ?? null,
      dosePratique: resolutionDose.dosePratique,
      dosePharmacologique: resolutionDose.dosePharmacologique,
      doseSourceConflict: resolutionDose.sourceHybrideDetectee,
      evidence,
    }, candidats);
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
