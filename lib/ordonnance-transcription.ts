import {
  extraireDateDelivrance,
  extraireDateDerniereVisite,
  extraireDateOrdonnance,
  sourceIndiqueDelivreCeJour,
} from "./ordonnance-dates.ts";
import {
  extraireDosesPratiquesContextuelles,
  extraireSourcesDose,
  type DoseSourceStructuree,
} from "./ordonnance-dose-sources.ts";
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
  titreDetecte?: string;
  issuDecoupage?: boolean;
}

interface TranscriptionOrdonnance {
  entete: { lignes: string[] };
  medicaments: BlocMedicamentTranscrit[];
}

const RUBRIQUES_MEDICAMENT = [
  "identification",
  "presentation",
  "posologie",
  "renouvellement",
  "delaisAttente",
  "instructionsPrecautions",
  "autres",
] as const;

type RubriqueMedicament = typeof RUBRIQUES_MEDICAMENT[number];

function objet(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function lignes(value: unknown): string[] {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(/\r?\n/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function blocVide(): BlocMedicamentTranscrit {
  return {
    identification: [],
    presentation: [],
    posologie: [],
    renouvellement: [],
    delaisAttente: [],
    instructionsPrecautions: [],
    autres: [],
  };
}

function normaliserPourDetection(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function sembleTitreMedicament(value: string): boolean {
  const titre = value.trim();
  if (titre.length < 3 || titre.length > 180) return false;
  const normalise = normaliserPourDetection(titre);
  if (/^(?:viande|abats?|lait|derniere visite|ordonnance|administration|injection|dose)\b/i.test(normalise)) {
    return false;
  }
  const lettres = titre.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? [];
  const majuscules = titre.match(/[A-ZÀ-ÖØ-Þ]/g) ?? [];
  const ressemblePresentation = /\b(?:FL|AER|SOL|INJ|ML|MG|BOLUS|CP)\b/i.test(normalise);
  return lettres.length >= 3 && (majuscules.length / lettres.length >= 0.7 || ressemblePresentation);
}

function debutMedicament(value: string): { numero: number; titre: string } | null {
  const match = value.match(/^\s*(\d{1,2})\s*(?:[-–—.)]|:\s)\s*(.+?)\s*$/);
  if (!match || !sembleTitreMedicament(match[2])) return null;
  return { numero: Number(match[1]), titre: match[2].trim() };
}

function rubriquePourLigne(value: string, rubriqueOrigine: RubriqueMedicament): RubriqueMedicament {
  if (rubriqueOrigine !== "autres") return rubriqueOrigine;
  const source = normaliserPourDetection(value).toLowerCase();
  if (/\b(?:viande|abats?|lait)\b\s*[:=-]?\s*\d/.test(source)) return "delaisAttente";
  if (/\b(?:deuxieme|seconde|2e|2eme)\s+(?:administration|injection)\b|\brenouvel/.test(source)) {
    return "renouvellement";
  }
  if (/\b\d+(?:[.,]\d+)?\s*(?:ml|mg|mcg|g|cp|comprime|bolus)\b.*\b(?:par|pour)\b/.test(source)) {
    return "posologie";
  }
  if (/\b(?:fl\.?|flacon|aer\.?|aerosol|ampoule|boite|qte|quantite)\b|\b\d+(?:[.,]\d+)?\s*(?:ml|cl|l)\b/.test(source)) {
    return "presentation";
  }
  return rubriqueOrigine;
}

function decouperBlocNumerote(bloc: BlocMedicamentTranscrit): BlocMedicamentTranscrit[] {
  const titres = new Map<number, string>();
  for (const rubrique of RUBRIQUES_MEDICAMENT) {
    for (const ligne of bloc[rubrique]) {
      const debut = debutMedicament(ligne);
      if (debut && !titres.has(debut.numero)) titres.set(debut.numero, debut.titre);
    }
  }
  if (titres.size === 0) return [bloc];

  const numeros = [...titres.keys()].sort((a, b) => a - b);
  const resultats = new Map<number, BlocMedicamentTranscrit>();
  for (const numero of numeros) {
    const titre = titres.get(numero)!;
    const resultat = blocVide();
    resultat.titreDetecte = titre;
    resultat.issuDecoupage = titres.size > 1;
    resultat.identification.push(titre);
    // Les titres reels contiennent souvent aussi la presentation (FL., AER., volume).
    resultat.presentation.push(titre);
    resultats.set(numero, resultat);
  }

  for (const rubrique of RUBRIQUES_MEDICAMENT) {
    // Avec un seul médicament numéroté, les autres rubriques n'ont pas besoin
    // de répéter son numéro : toutes leurs lignes appartiennent à ce bloc.
    let numeroCourant: number | null = numeros.length === 1 ? numeros[0] : null;
    for (const ligne of bloc[rubrique]) {
      const debut = debutMedicament(ligne);
      if (debut && resultats.has(debut.numero)) {
        numeroCourant = debut.numero;
        continue;
      }
      // Sans titre numerote dans cette rubrique, l'affectation serait arbitraire.
      if (numeroCourant === null) continue;
      const destination = resultats.get(numeroCourant)!;
      destination[rubriquePourLigne(ligne, rubrique)].push(ligne);
    }
  }
  return numeros.map((numero) => resultats.get(numero)!);
}

function decouperMedicaments(blocs: BlocMedicamentTranscrit[]): BlocMedicamentTranscrit[] {
  return blocs.flatMap(decouperBlocNumerote);
}

function extraireVeterinaire(sourceTexts: string[]): string | null {
  for (const sourceText of sourceTexts) {
    const ligne = sourceText.trim();
    const normalisee = normaliserPourDetection(ligne);
    if (/\b(?:adresse|telephone|tel\.?|email|mail)\b/i.test(normalisee)) continue;
    if (/^dr\s*\.?\s*v\b\s+\p{L}[\p{L}'’.-]*(?:\s+\p{L}[\p{L}'’.-]*)+/iu.test(ligne)) return ligne;
    const libelle = ligne.match(/^\s*(?:veterinaire|prescripteur)\s*[:=-]\s*(.+)$/i);
    if (libelle && /\p{L}{2,}/u.test(libelle[1])) return libelle[1].trim();
  }
  return null;
}

function nomDepuisBloc(bloc: BlocMedicamentTranscrit, propositionIA: unknown): string | null {
  for (const ligne of bloc.identification) {
    const debut = debutMedicament(ligne);
    const candidat = debut?.titre ?? ligne.trim();
    if (sembleTitreMedicament(candidat)) return candidat;
  }
  if (bloc.titreDetecte) return bloc.titreDetecte;
  if (typeof propositionIA === "string" && propositionIA.trim()) return propositionIA.trim();
  for (const ligne of bloc.autres) {
    const debut = debutMedicament(ligne);
    if (debut) return debut.titre;
    if (sembleTitreMedicament(ligne)) return ligne.trim();
  }
  return null;
}

function lireTranscription(value: unknown): TranscriptionOrdonnance | null {
  const transcription = objet(value);
  const lignesEntete = lignes(objet(transcription.entete).lignes);
  const medicamentsBruts = Array.isArray(transcription.medicaments)
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
  const medicaments = decouperMedicaments(medicamentsBruts);
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
    if (/\brenouvellement\s+interdit\b/.test(source)) return "renouvellement interdit";
    if (!/\b(si|si necessaire|si besoin|en cas de)\b/.test(source)) continue;
    const condition = normaliserConditionRenouvellement(sourceText);
    if (condition) return condition;
  }
  return null;
}

function dureeTraitement(sourceTexts: string[]): number | null {
  for (const sourceText of sourceTexts) {
    const source = normaliserPourDetection(sourceText).toLowerCase();
    const match = source.match(/\b(?:pendant|durant|duree\s*[:=-]?)\s*(\d{1,3})\s*(?:j|jour|jours)\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

function voieDepuisBloc(sourceTexts: string[]): string | null {
  const source = normaliserPourDetection(sourceTexts.join(" ")).toLowerCase();
  const voies = [
    ["IV", /\b(?:intraveineuse|intra\s*veineuse)\b/],
    ["IM", /\b(?:intramusculaire|intra\s*musculaire)\b/],
    ["SC", /\b(?:sous[- ]?cutanee)\b/],
  ] as const;
  const trouvees = voies.filter(([, expression]) => expression.test(source)).map(([code]) => code);
  return trouvees.length > 0 ? trouvees.join(" / ") : null;
}

function numeroLotDepuisBloc(bloc: BlocMedicamentTranscrit): string | null {
  for (const rubrique of RUBRIQUES_MEDICAMENT) {
    for (const ligne of bloc[rubrique]) {
      const match = ligne.match(/\blot\s*[:#=-]?\s*([A-Z0-9][A-Z0-9./_-]*)\b/i);
      if (match) return match[1];
    }
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
  const veterinaireStructure = typeof source.veterinaire === "string" && source.veterinaire.trim()
    ? source.veterinaire.trim() : null;
  const veterinaire = extraireVeterinaire(entete) ?? veterinaireStructure;
  const evidenceEntete = objet(source.evidence);
  const medicamentsIA = Array.isArray(source.medicaments) ? source.medicaments : [];
  const nombreMedicaments = Math.max(medicamentsIA.length, transcription.medicaments.length);
  const medicaments = Array.from({ length: nombreMedicaments }, (_, index) => {
    const bloc = transcription.medicaments[index];
    const ia = bloc?.issuDecoupage && medicamentsIA.length !== transcription.medicaments.length
      ? {} : objet(medicamentsIA[index]);
    if (!bloc) return ia;
    const evidenceIA = objet(ia.evidence);
    const patch: Record<string, unknown> = { ...ia, __transcriptionParBlocs: true };

    patch.medicamentNom = nomDepuisBloc(bloc, ia.medicamentNom);
    patch.numeroLot = numeroLotDepuisBloc(bloc) ?? ia.numeroLot ?? null;

    const voieTranscrite = voieDepuisBloc([...bloc.posologie, ...bloc.instructionsPrecautions]);
    if (voieTranscrite) patch.voie = voieTranscrite;

    if (bloc.presentation.length > 0) {
      const sourceText = bloc.presentation.join("\n");
      const presentationIA = objet(ia.presentation);
      const quantitePreuve = objet(evidenceIA.deliveredQuantity).value;
      const presentation = {
        ...presentationIA,
        sourceText,
        ...(presentationIA.deliveredQuantity == null && quantitePreuve != null
          ? { deliveredQuantity: quantitePreuve }
          : {}),
      };
      patch.conditionnement = normaliserConditionnementExtrait({
        conditionnement: null,
        presentation,
        sourceTexts: bloc.presentation,
      });
      patch.presentation = presentation;
      patch.evidence = {
        ...evidenceIA,
        conditionnement: preuve(patch.conditionnement, sourceText, "presentation"),
      };
    }

    if (bloc.posologie.length > 0) {
      const dosesPratiques = extraireDosesPratiquesContextuelles(bloc.posologie);
      const premierePratique = dosesPratiques[0];
      const dosePratique = premierePratique ? {
        doseValue: premierePratique.doseValue,
        doseUnit: premierePratique.doseUnit,
        referenceValue: premierePratique.poidsMinKg && premierePratique.poidsMinKg === premierePratique.poidsMaxKg
          ? premierePratique.poidsMinKg : "",
        referenceUnit: premierePratique.poidsMinKg && premierePratique.poidsMinKg === premierePratique.poidsMaxKg ? "kg" : "",
        referenceType: premierePratique.poidsMinKg ? "live_weight" : "animal",
        sourceText: premierePratique.sourceText,
      } : premiereDose(bloc.posologie, "dosePratique");
      const dosePharmacologique = premiereDose(bloc.posologie, "dosePharmacologique");
      const dosePrincipale = dosePratique ?? dosePharmacologique;
      patch.dosesPratiques = dosesPratiques;
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
      const duree = dureeTraitement(bloc.posologie);
      if (duree !== null) {
        patch.administrationProtocol = {
          ...objet(ia.administrationProtocol),
          treatmentDurationDays: duree,
        };
      }
    }

    if (bloc.renouvellement.length > 0) {
      const protocoleIA = objet(patch.administrationProtocol);
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
    veterinaire,
    evidence: {
      ...evidenceEntete,
      ...(prescriptionDate ? { prescriptionDate: preuve(prescriptionDate, texteEntete, "en-tete") } : {}),
      ...(lastVisitDate ? { lastVisitDate: preuve(lastVisitDate, texteEntete, "en-tete") } : {}),
    },
    medicaments,
  };
}
