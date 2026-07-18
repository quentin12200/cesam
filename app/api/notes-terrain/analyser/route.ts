import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch, searchTypesEvenement, type RecherchableTypeEvenement } from "@/lib/fuzzy-search";
import {
  extraireNumerosTravail,
  extrairePattes,
  extraireTemperature,
  compactVoiceText,
  distanceEdition,
  normaliserNumeroTravail,
  phonetiserMot,
  type VoiceSanitaryDraft,
  type VoiceTarget,
} from "@/lib/voice-sanitary";
import { analyserIntentionsVocales, interpreterSexeVeau } from "@/lib/voice-intent";

const ALIASES_EVENEMENTS: Array<[RegExp, string]> = [
  [/\bboite(?:rie)?\b/, "boiterie"],
  [/\bdiarrhee\b/, "diarrhée"],
  [/\bmammite\b/, "mammite"],
  [/\bmetrite\b/, "métrite"],
  [/\bfievre\b/, "fièvre"],
  [/\btoux\b/, "toux"],
  [/\bblessure\b/, "blessure"],
];

function dateFrance(offsetJours = 0) {
  const morceaux = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valeur = Object.fromEntries(morceaux.map((morceau) => [morceau.type, morceau.value]));
  const date = new Date(Date.UTC(Number(valeur.year), Number(valeur.month) - 1, Number(valeur.day)));
  date.setUTCDate(date.getUTCDate() + offsetJours);
  return date.toISOString().slice(0, 10);
}

function extraireDate(texte: string, texteNormalise: string) {
  const dateChiffree = texte.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);
  if (dateChiffree) {
    const anneeCourante = Number(dateFrance().slice(0, 4));
    const anneeBrute = dateChiffree[3] ? Number(dateChiffree[3]) : anneeCourante;
    const annee = anneeBrute < 100 ? 2000 + anneeBrute : anneeBrute;
    const candidate = `${String(annee).padStart(4, "0")}-${dateChiffree[2].padStart(2, "0")}-${dateChiffree[1].padStart(2, "0")}`;
    const date = new Date(`${candidate}T12:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate) return candidate;
  }
  if (/\bavant hier\b/.test(texteNormalise)) return dateFrance(-2);
  if (/\bhier\b/.test(texteNormalise)) return dateFrance(-1);
  if (/\bdemain\b/.test(texteNormalise)) return dateFrance(1);
  if (/\baujourd[’']?hui\b/.test(texteNormalise)) return dateFrance();
  return dateFrance();
}

function momentFrance(texteNormalise: string): "Matin" | "Soir" {
  if (/\bmatin\b/.test(texteNormalise)) return "Matin";
  if (/\bsoir\b/.test(texteNormalise)) return "Soir";
  const heure = Number(new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
  return heure < 12 ? "Matin" : "Soir";
}

function trouverEvenement(texteNormalise: string, types: RecherchableTypeEvenement[], temperature: number | null) {
  const directs = types
    .map((type) => ({ type, nom: normalizeSearch(type.nom) }))
    .filter(({ nom }) => nom.length >= 4 && texteNormalise.includes(nom))
    .sort((a, b) => b.nom.length - a.nom.length);
  if (directs[0]) return directs[0].type;

  for (const type of types) {
    const synonymes = type.synonymes?.split(",").map(normalizeSearch).filter((synonyme) => synonyme.length >= 4) ?? [];
    if (synonymes.some((synonyme) => texteNormalise.includes(synonyme))) return type;
  }

  for (const [expression, recherche] of ALIASES_EVENEMENTS) {
    if (!expression.test(texteNormalise)) continue;
    const resultat = searchTypesEvenement(recherche, types)[0];
    if (resultat && resultat.score >= 70) return resultat.item;
  }

  if (temperature !== null) {
    const resultat = searchTypesEvenement("fièvre", types)[0];
    if (resultat && resultat.score >= 70) return resultat.item;
  }
  return null;
}

function variantesMedicament(nom: string, dci: string | null) {
  const motsIgnores = new Set(["la", "lp", "rs", "pi3", "intranasa", "intranasal", "nasal", "orale", "oral", "im", "iv", "sc"]);
  const variantes = new Set<string>();
  for (const valeur of [nom, dci].filter((item): item is string => Boolean(item))) {
    const normalise = normalizeSearch(valeur);
    const mots = normalise.split(/[^a-z0-9]+/).filter(Boolean);
    variantes.add(compactVoiceText(normalise));
    const significatifs = mots.filter((mot) => !motsIgnores.has(mot));
    if (significatifs.length > 0) variantes.add(compactVoiceText(significatifs.join("")));
    for (const mot of significatifs) {
      if (mot.length >= 5) variantes.add(compactVoiceText(mot));
    }
  }
  return [...variantes].filter((variante) => variante.length >= 3);
}

function segmentsPhonetiques(texteNormalise: string) {
  const mots = texteNormalise.split(/\s+/).filter((mot) => /[a-z]/.test(mot));
  const segments = new Map<string, string>();
  for (let debut = 0; debut < mots.length; debut++) {
    for (let taille = 1; taille <= 4 && debut + taille <= mots.length; taille++) {
      const brut = mots.slice(debut, debut + taille).join(" ");
      segments.set(brut, phonetiserMot(brut));
    }
  }
  return [...segments].map(([brut, phonetique]) => ({ brut, phonetique })).filter((segment) => segment.phonetique);
}

function trouverMedicament(
  texteNormalise: string,
  medicaments: Array<{ id: string; nom: string; dci: string | null }>,
  aliases: Array<{ alias: string; transcription: string; medicament: { id: string; nom: string; dci: string | null; actif: boolean } }>,
) {
  const phraseCompacte = compactVoiceText(texteNormalise);
  const aliasConnu = aliases.find((item) => item.medicament.actif && phraseCompacte.includes(item.alias));
  if (aliasConnu) {
    return {
      medicament: aliasConnu.medicament,
      entendu: aliasConnu.transcription,
      candidates: [],
    };
  }

  const segments = segmentsPhonetiques(texteNormalise);
  const correspondances = medicaments.map((medicament) => {
    let meilleurRatio = Number.POSITIVE_INFINITY;
    let entendu = "";
    for (const variante of variantesMedicament(medicament.nom, medicament.dci)) {
      if (phraseCompacte.includes(variante)) {
        meilleurRatio = 0;
        entendu = variante;
        continue;
      }
      if (variante.length < 5) continue;
      const terme = phonetiserMot(variante);
      for (const segment of segments) {
        const ratio = distanceEdition(segment.phonetique, terme) / Math.max(segment.phonetique.length, terme.length);
        if (ratio < meilleurRatio) {
          meilleurRatio = ratio;
          entendu = segment.brut;
        }
      }
    }
    return { medicament, ratio: meilleurRatio, entendu };
  });
  correspondances.sort((a, b) => a.ratio - b.ratio || b.medicament.nom.length - a.medicament.nom.length);
  const meilleur = correspondances[0];
  const accepte = meilleur && meilleur.ratio <= 0.28;
  const candidats = correspondances
    .filter((item) => item.ratio <= 0.5 && item.entendu.length >= 3)
    .slice(0, 3)
    .map((item) => ({ id: item.medicament.id, nom: item.medicament.nom }));
  return {
    medicament: accepte ? meilleur.medicament : null,
    entendu: meilleur?.entendu || null,
    candidates: accepte ? [] : candidats,
  };
}

function trouverVoieAdministration(texteNormalise: string): string | null {
  const voies: Array<[string, RegExp]> = [
    ["NASALE", /\b(?:intra\s*nasal(?:e)?|nasal(?:e)?|dans le nez)\b/],
    ["IMM", /\b(?:intra\s*mammaire|dans le quartier)\b/],
    ["IM", /\b(?:intra\s*musculaire|intramusculaire|i m)\b/],
    ["IV", /\b(?:intra\s*veineuse|intraveineuse|i v)\b/],
    ["SC", /\b(?:sous\s*cutanee|souscutanee|s c)\b/],
    ["PO", /\b(?:voie orale|par la bouche|oral(?:e)?)\b/],
    ["POUR_ON", /\b(?:pour\s*on|pour-on)\b/],
  ];
  return voies.find(([, expression]) => expression.test(texteNormalise))?.[0] ?? null;
}

function normaliserPhraseAiguillage(phrase: string) {
  return normalizeSearch(phrase)
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trouverTaureau(
  texteNormalise: string,
  taureaux: Array<{ id: string; nupere: string; nopere: string | null; present: boolean }>,
) {
  const directs = taureaux
    .flatMap((taureau) => [taureau.nopere, taureau.nupere]
      .filter((nom): nom is string => Boolean(nom))
      .map((nom) => ({ taureau, nom: normalizeSearch(nom) })))
    .filter(({ nom }) => nom.length >= 3 && ` ${texteNormalise} `.includes(` ${nom} `))
    .sort((a, b) => b.nom.length - a.nom.length);
  if (directs[0]) return directs[0].taureau;

  const motsIgnores = new Set(["la", "le", "les", "avec", "taureau", "vache", "une", "un", "est", "fait", "faire", "sa", "a", "au"]);
  const mots = texteNormalise.split(/\s+/).filter((mot) => /[a-z]/.test(mot) && !motsIgnores.has(mot));
  const segments: string[] = [];
  for (let debut = 0; debut < mots.length; debut++) {
    for (let taille = 1; taille <= 3 && debut + taille <= mots.length; taille++) {
      segments.push(mots.slice(debut, debut + taille).join(" "));
    }
  }

  const correspondances = taureaux.flatMap((taureau) => [taureau.nopere, taureau.nupere]
    .filter((nom): nom is string => Boolean(nom))
    .map((nom) => {
      const nomPhonetique = phonetiserMot(normalizeSearch(nom));
      const meilleurRatio = segments.reduce((meilleur, segment) => {
        const segmentPhonetique = phonetiserMot(segment);
        if (!segmentPhonetique || !nomPhonetique) return meilleur;
        const ratio = distanceEdition(segmentPhonetique, nomPhonetique) / Math.max(segmentPhonetique.length, nomPhonetique.length);
        return Math.min(meilleur, ratio);
      }, Number.POSITIVE_INFINITY);
      return { taureau, ratio: meilleurRatio };
    }));
  correspondances.sort((a, b) => a.ratio - b.ratio);
  return correspondances[0] && correspondances[0].ratio <= 0.28 ? correspondances[0].taureau : null;
}

function reconnaitreActionReproduction(texteNormalise: string) {
  const ia = /\b(?:ia|i a|insemin(?:ation|ee|e|er)|j ai fait l ia)\b/.test(texteNormalise);
  const naturelleDirecte = /\b(?:saillie|sailli|sailly|sailliee|ca y est|avec le taureau)\b/.test(texteNormalise);
  const sailliePhonetique = phonetiserMot("saillie");
  const naturellePhonetique = texteNormalise.split(/\s+/).some((mot) => {
    if (mot.length < 3 || !/[a-z]/.test(mot)) return false;
    const motPhonetique = phonetiserMot(mot);
    return Boolean(motPhonetique && distanceEdition(motPhonetique, sailliePhonetique) / Math.max(motPhonetique.length, sailliePhonetique.length) <= 0.3);
  });
  return { ia, naturelle: naturelleDirecte || naturellePhonetique };
}

function extrairePoids(texteNormalise: string): number | null {
  const match = texteNormalise.match(/\b(?:pese|poids(?: de)?)\s+(\d{2,4}(?:[,.]\d+)?)\s*(?:kg|kilo(?:s|grammes?)?)\b/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transcript = typeof body.texte === "string" ? body.texte.trim() : "";
  if (!transcript) return NextResponse.json({ error: "texte requis" }, { status: 400 });

  const texteNormalise = normalizeSearch(transcript);
  const [animaux, groupes, types, medicaments, aliasesVocaux, taureaux, aliasesAiguillage] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: { nutrav: true, nobovi: true, sexbov: true },
      orderBy: { nutrav: "asc" },
    }),
    prisma.groupe.findMany({
      select: {
        nom: true,
        animaux: { where: { statut: "ACTIF" }, select: { nutrav: true } },
      },
    }),
    prisma.typeEvenement.findMany({
      where: { actif: true },
      select: { id: true, nom: true, synonymes: true },
    }),
    prisma.medicament.findMany({
      where: { actif: true },
      select: { id: true, nom: true, dci: true },
    }),
    prisma.medicamentAliasVocal.findMany({
      select: {
        alias: true,
        transcription: true,
        medicament: { select: { id: true, nom: true, dci: true, actif: true } },
      },
    }),
    prisma.taureau.findMany({
      select: { id: true, nupere: true, nopere: true, present: true },
    }),
    prisma.voiceRoutingAlias.findMany({
      select: { phraseNormalisee: true, action: true },
    }),
  ]);
  const poids = extrairePoids(texteNormalise);
  const numeroPoids = poids === null ? null : normaliserNumeroTravail(String(Math.trunc(poids)));
  const numerosDictes = extraireNumerosTravail(transcript, animaux.map((animal) => animal.nutrav))
    .filter((numero) => numero !== numeroPoids);

  let target: VoiceTarget | null = null;
  let candidates: Array<{ nutrav: string; nom: string | null }> = [];

  if (numerosDictes.length > 0) {
    const exacts = numerosDictes
      .map((numero) => animaux.find((animal) => normaliserNumeroTravail(animal.nutrav) === numero))
      .filter((animal): animal is (typeof animaux)[number] => Boolean(animal));
    if (exacts.length === numerosDictes.length) {
      target = {
        kind: "animal",
        label: exacts.map((animal) => `${animal.nutrav}${animal.nobovi ? ` · ${animal.nobovi}` : ""}`).join(", "),
        nutravs: exacts.map((animal) => animal.nutrav),
      };
    } else {
      const nonTrouves = numerosDictes.filter((numero) => !exacts.some((animal) => normaliserNumeroTravail(animal.nutrav) === numero));
      candidates = nonTrouves.flatMap((numero) => {
        const chiffresDictes = numero.replace(/^0+/, "") || "0";
        return animaux
          .filter((animal) => animal.nutrav.replace(/^0+/, "").endsWith(chiffresDictes))
          .map((animal) => ({ nutrav: animal.nutrav, nom: animal.nobovi }));
      }).filter((candidate, index, liste) => liste.findIndex((item) => item.nutrav === candidate.nutrav) === index).slice(0, 8);
      if (exacts.length > 0) {
        target = {
          kind: "animal",
          label: exacts.map((animal) => `${animal.nutrav}${animal.nobovi ? ` · ${animal.nobovi}` : ""}`).join(", "),
          nutravs: exacts.map((animal) => animal.nutrav),
        };
      }
    }
  } else {
    const demandeLot = /\b(?:lot|groupe)\b/.test(texteNormalise);
    if (demandeLot) {
      const groupesTrouves = groupes.filter((groupe) => texteNormalise.includes(normalizeSearch(groupe.nom)) && groupe.animaux.length > 0);
      if (groupesTrouves.length === 1) {
        target = {
          kind: "lot",
          label: `${groupesTrouves[0].nom} · ${groupesTrouves[0].animaux.length} animaux`,
          nutravs: groupesTrouves[0].animaux.map((animal) => animal.nutrav),
        };
      }
    }
  }

  const phraseAiguillage = normaliserPhraseAiguillage(transcript);
  const aliasAiguillage = aliasesAiguillage.find((alias) => alias.phraseNormalisee === phraseAiguillage);
  const actionReproduction = reconnaitreActionReproduction(texteNormalise);
  const taureauReconnu = trouverTaureau(texteNormalise, taureaux);
  const animauxCibles = target?.kind === "animal"
    ? target.nutravs.map((nutrav) => animaux.find((animal) => animal.nutrav === nutrav)).filter(Boolean)
    : [];
  const cibleFemelle = animauxCibles.length > 0 && animauxCibles.every((animal) => animal?.sexbov.toUpperCase().startsWith("F"));
  const deductionParContexte = cibleFemelle && taureauReconnu !== null;
  const intentionSaillie = actionReproduction.ia
    || actionReproduction.naturelle
    || aliasAiguillage?.action === "saillie"
    || deductionParContexte;
  const reproductionType: "NATURELLE" | "IA" | null = intentionSaillie
    ? (actionReproduction.ia || taureauReconnu?.present === false ? "IA" : "NATURELLE")
    : null;
  const temperature = extraireTemperature(texteNormalise);
  const event = trouverEvenement(texteNormalise, types, temperature);
  const reconnaissanceMedicament = trouverMedicament(texteNormalise, medicaments, aliasesVocaux);
  const medicament = intentionSaillie ? null : reconnaissanceMedicament.medicament;
  const candidatConfondEvenement = Boolean(
    !medicament
    && event
    && reconnaissanceMedicament.entendu
    && compactVoiceText(event.nom) === compactVoiceText(reconnaissanceMedicament.entendu),
  );
  const medicamentCandidates = intentionSaillie || candidatConfondEvenement ? [] : reconnaissanceMedicament.candidates;
  const medicamentEntendu = medicament || medicamentCandidates.length > 0 ? reconnaissanceMedicament.entendu : null;
  const voieAdministration = trouverVoieAdministration(texteNormalise)
    ?? (medicament ? trouverVoieAdministration(normalizeSearch(medicament.nom)) : null);
  const pattes = extrairePattes(texteNormalise);
  const ajouterAuParage = /\b(?:ajout(?:e|er)?|mettre|mets)\b.*\bparage\b|\bliste de parage\b/.test(texteNormalise);
  const rappelDemande = /\b(?:rappel|rappeler|rappelle|surveiller|surveillance)\b/.test(texteNormalise);
  const traitementMentionne = /\btraitement\b/.test(texteNormalise) || medicament !== null;
  const estBoiterie = Boolean(event && normalizeSearch(event.nom) === "boiterie") || /\bboite(?:rie)?\b/.test(texteNormalise);
  const actionApprise = aliasAiguillage && ["sanitaire", "parage", "saillie", "chaleur", "pesee", "velage"].includes(aliasAiguillage.action)
    ? aliasAiguillage.action as "sanitaire" | "parage" | "saillie" | "chaleur" | "pesee" | "velage"
    : null;
  const contexteIntentions = {
    texte: texteNormalise,
    cibleTrouvee: Boolean(target),
    cibleFemelle,
    taureauTrouve: taureauReconnu !== null,
    medicamentTrouve: medicament !== null,
    medicamentIncertain: medicamentCandidates.length > 0,
    evenementTrouve: event !== null,
    poidsTrouve: poids !== null,
    temperatureTrouvee: temperature !== null,
    sexeTrouve: false,
    pattesTrouvees: pattes.length > 0,
    traitementMentionne,
    ajouterAuParage,
    actionApprise,
  };
  const analysePreliminaire = analyserIntentionsVocales(contexteIntentions);
  const veauSexe = interpreterSexeVeau(
    texteNormalise,
    analysePreliminaire.scores.velage >= 4 || actionApprise === "velage",
  );
  const analyseIntentions = analyserIntentionsVocales({ ...contexteIntentions, sexeTrouve: veauSexe !== null });
  const suggestedActions = analyseIntentions.actions.length > 0
    ? analyseIntentions.actions
    : estBoiterie ? ["sanitaire" as const, "parage" as const] : [];

  const draft: VoiceSanitaryDraft = {
    transcript,
    target,
    numerosNonTrouves: numerosDictes.filter((numero) => !animaux.some((animal) => normaliserNumeroTravail(animal.nutrav) === numero)),
    event: event ? { id: event.id, nom: event.nom } : null,
    date: extraireDate(transcript, texteNormalise),
    moment: momentFrance(texteNormalise),
    dateMentionnee: Boolean(transcript.match(/\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/) || /\b(?:avant hier|hier|demain|aujourd[’']?hui)\b/.test(texteNormalise)),
    momentMentionne: /\b(?:matin|soir)\b/.test(texteNormalise),
    temperature,
    poids,
    veauSexe,
    pattes,
    ajouterAuParage,
    medicament: medicament ? { id: medicament.id, nom: medicament.nom } : null,
    medicamentEntendu,
    medicamentCandidates,
    voieAdministration,
    rappelDemande,
    traitementMentionne,
    reproductionType,
    taureau: taureauReconnu ? {
      id: taureauReconnu.id,
      nom: taureauReconnu.nopere ?? taureauReconnu.nupere,
      present: taureauReconnu.present,
    } : null,
    description: transcript,
    suggestedActions,
  };

  const informationMetier = suggestedActions.length > 0;
  if (draft.numerosNonTrouves.length > 0 && informationMetier) {
    return NextResponse.json({ outcome: "confirm_animal", draft, candidates });
  }
  if (!target || !informationMetier) {
    const reason = numerosDictes.length > 0 && !target ? `Animal non trouvé : aucune saisie créée` : "Phrase trop imprécise : aucune saisie créée";
    return NextResponse.json({ outcome: "note", reason });
  }
  if (draft.suggestedActions.length > 1) {
    return NextResponse.json({ outcome: "choose_action", draft });
  }
  return NextResponse.json({ outcome: "draft", draft });
}

export const dynamic = "force-dynamic";
