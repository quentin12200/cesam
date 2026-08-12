import {
  extraireDateDelivrance,
  extraireDateDerniereVisite,
  extraireDateOrdonnance,
  sourceIndiqueDelivreCeJour,
} from "./ordonnance-dates.ts";
import { extraireSourcesDose, type DoseSourceStructuree } from "./ordonnance-dose-sources.ts";
import {
  normaliserConditionnementExtrait,
  normaliserConditionRenouvellement,
} from "./ordonnance-display.ts";

interface BlocMedicamentTranscrit {
  identification: string[];
  presentation: string[];
  posologie: string[];
  renouvellement: string[];
  delaisAttente: string[];
  instructionsPrecautions: string[];
  autres: string[];
}

interface TranscriptionOrdonnance {
  entete: { lignes: string[] };
  medicaments: BlocMedicamentTranscrit[];
}

function objet(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function lignes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function lireTranscription(value: unknown): TranscriptionOrdonnance | null {
  const transcription = objet(value);
  const lignesEntete = lignes(objet(transcription.entete).lignes);
  const medicaments = Array.isArray(transcription.medicaments)
    ? transcription.medicaments.map((raw) => {
      const bloc = objet(raw);
      return {
        identification: lignes(bloc.identification),
        presentation: lignes(bloc.presentation),
        posologie: lignes(bloc.posologie),
        renouvellement: lignes(bloc.renouvellement),
        delaisAttente: lignes(bloc.delaisAttente),
        instructionsPrecautions: lignes(bloc.instructionsPrecautions),
        autres: lignes(bloc.autres),
      };
    })
    : [];
  return lignesEntete.length > 0 || medicaments.length > 0
    ? { entete: { lignes: lignesEntete }, medicaments }
    : null;
}

function premiereDose(
  sourceTexts: string[],
  type: "dosePratique" | "dosePharmacologique",
): DoseSourceStructuree | null {
  for (const sourceText of sourceTexts) {
    const dose = extraireSourcesDose(sourceText)[type];
    if (dose) return dose;
  }
  return null;
}

function delaisDepuisBloc(sourceTexts: string[]): {
  meatDays: number | null;
  offalDays: number | null;
  milkDays: number | null;
} {
  let meatDays: number | null = null;
  let offalDays: number | null = null;
  let milkDays: number | null = null;
  for (const sourceText of sourceTexts) {
    const source = sourceText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const commun = source.match(/\bviande\s+(?:et|&)\s+abats?\s*[:=\-]?\s*(\d{1,3})\s*(?:j|jour|jours)\b/i);
    if (commun) meatDays = offalDays = Number(commun[1]);
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

function numeroOrdonnance(sourceTexts: string[]): string | null {
  for (const sourceText of sourceTexts) {
    const match = sourceText.match(/\bordonnance\b\s*(?:n[^\d]{0,4})?([0-9][A-Za-z0-9[\]./_-]*)/i);
    if (match) return match[1];
  }
  return null;
}

function intervalleRenouvellement(sourceTexts: string[]): number | null {
  for (const sourceText of sourceTexts) {
    const match = sourceText.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .match(/\bapres\s+(\d+(?:[.,]\d+)?)\s*(h|heure|heures|jour|jours|j)\b/i);
    if (!match) continue;
    const valeur = Number(match[1].replace(",", "."));
    return /^(?:h|heure)/i.test(match[2]) ? valeur : valeur * 24;
  }
  return null;
}

function conditionRenouvellement(sourceTexts: string[]): string | null {
  for (const sourceText of sourceTexts) {
    const source = sourceText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!/\b(si|si necessaire|si besoin|en cas de)\b/.test(source)) continue;
    const condition = normaliserConditionRenouvellement(sourceText);
    if (condition) return condition;
  }
  return null;
}

function renouvellementConditionnel(sourceTexts: string[]): boolean {
  return sourceTexts.some((sourceText) => {
    const source = sourceText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /\b(deuxieme|seconde|2e|2eme)\s+(?:administration|injection)\b/.test(source)
      && /\b(si|si necessaire|si besoin|pourra|peut|eventuellement)\b/.test(source);
  });
}

function preuve(value: unknown, sourceText: string, zone: string): Record<string, unknown> {
  return { value, sourceText, confidence: 1, zone };
}

/**
 * Reconstruit les champs fiables avant la normalisation CESAM. Lorsqu'un bloc
 * transcrit existe, seules ses lignes peuvent alimenter la rubrique associée.
 */
export function appliquerTranscriptionParBlocs(
  parsed: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const transcription = lireTranscription(source.transcription);
  if (!transcription) return source;

  const entete = transcription.entete.lignes;
  const texteEntete = entete.join("\n");
  const prescriptionDate = entete.map(extraireDateOrdonnance).find(Boolean) ?? null;
  const lastVisitDate = entete.map(extraireDateDerniereVisite).find(Boolean) ?? null;
  const deliveryDateExplicite = entete.map(extraireDateDelivrance).find(Boolean) ?? null;
  const deliveryDate = deliveryDateExplicite
    ?? (prescriptionDate && entete.some(sourceIndiqueDelivreCeJour) ? prescriptionDate : null);
  const evidenceEntete = objet(source.evidence);
  const medicamentsIA = Array.isArray(source.medicaments) ? source.medicaments : [];
  const nombreMedicaments = Math.max(medicamentsIA.length, transcription.medicaments.length);
  const medicaments = Array.from({ length: nombreMedicaments }, (_, index) => {
    const ia = objet(medicamentsIA[index]);
    const bloc = transcription.medicaments[index];
    if (!bloc) return ia;
    const evidenceIA = objet(ia.evidence);
    const patch: Record<string, unknown> = { ...ia, __transcriptionParBlocs: true };

    if (bloc.identification.length > 0) patch.medicamentNom = bloc.identification[0];

    if (bloc.presentation.length > 0) {
      const sourceText = bloc.presentation.join("\n");
      patch.conditionnement = normaliserConditionnementExtrait({
        conditionnement: null,
        presentation: { sourceText },
        sourceTexts: bloc.presentation,
      });
      patch.presentation = { sourceText };
      patch.evidence = {
        ...evidenceIA,
        conditionnement: preuve(patch.conditionnement, sourceText, "presentation"),
      };
    }

    if (bloc.posologie.length > 0) {
      const dosePratique = premiereDose(bloc.posologie, "dosePratique");
      const dosePharmacologique = premiereDose(bloc.posologie, "dosePharmacologique");
      const dosePrincipale = dosePratique ?? dosePharmacologique;
      patch.dosePratique = dosePratique;
      patch.dosePharmacologique = dosePharmacologique;
      patch.dose = dosePrincipale ? {
        ...dosePrincipale,
        normalizedDoseValue: null,
        normalizedDoseUnit: null,
      } : {};
      patch.evidence = {
        ...objet(patch.evidence),
        dose: preuve(dosePrincipale, bloc.posologie.join("\n"), "posologie"),
      };
    }

    if (bloc.renouvellement.length > 0) {
      const protocoleIA = objet(ia.administrationProtocol);
      const intervalle = intervalleRenouvellement(bloc.renouvellement);
      const condition = conditionRenouvellement(bloc.renouvellement);
      patch.administrationProtocol = {
        ...protocoleIA,
        administrationCount: renouvellementConditionnel(bloc.renouvellement)
          ? 1 : protocoleIA.administrationCount ?? null,
        administrationIntervalHours: intervalle,
        repeatCondition: condition,
        administrationInstructions: bloc.instructionsPrecautions.length > 0
          ? bloc.instructionsPrecautions.join("\n") : protocoleIA.administrationInstructions ?? null,
      };
      patch.evidence = {
        ...objet(patch.evidence),
        administrationProtocol: preuve(
          { administrationIntervalHours: intervalle, repeatCondition: condition },
          bloc.renouvellement.join("\n"),
          "renouvellement",
        ),
      };
    }

    if (bloc.renouvellement.length === 0 && bloc.instructionsPrecautions.length > 0) {
      patch.administrationProtocol = {
        ...objet(ia.administrationProtocol),
        administrationInstructions: bloc.instructionsPrecautions.join("\n"),
      };
    }

    if (bloc.delaisAttente.length > 0) {
      const delais = delaisDepuisBloc(bloc.delaisAttente);
      patch.withdrawalPeriods = delais;
      patch.evidence = {
        ...objet(patch.evidence),
        withdrawalPeriods: preuve(delais, bloc.delaisAttente.join("\n"), "delais-attente"),
      };
    }

    return patch;
  });

  return {
    ...source,
    dates: entete.length > 0 ? { prescriptionDate, lastVisitDate, deliveryDate } : source.dates,
    ordonnanceNumero: numeroOrdonnance(entete) ?? source.ordonnanceNumero ?? null,
    evidence: {
      ...evidenceEntete,
      ...(prescriptionDate ? { prescriptionDate: preuve(prescriptionDate, texteEntete, "en-tete") } : {}),
      ...(lastVisitDate ? { lastVisitDate: preuve(lastVisitDate, texteEntete, "en-tete") } : {}),
    },
    medicaments,
  };
}
