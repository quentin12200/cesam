import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch, searchTypesEvenement, type RecherchableTypeEvenement } from "@/lib/fuzzy-search";
import {
  extraireNumeroTravail,
  extrairePattes,
  extraireTemperature,
  compactVoiceText,
  distanceEdition,
  normaliserNumeroTravail,
  phonetiserMot,
  type VoiceSanitaryDraft,
  type VoiceTarget,
} from "@/lib/voice-sanitary";

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
  return dateFrance();
}

function momentFrance(texteNormalise: string): "Matin" | "Soir" {
  if (/\bmatin\b/.test(texteNormalise)) return "Matin";
  if (/\bsoir\b/.test(texteNormalise)) return "Soir";
  const heure = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(new Date()));
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transcript = typeof body.texte === "string" ? body.texte.trim() : "";
  if (!transcript) return NextResponse.json({ error: "texte requis" }, { status: 400 });

  const texteNormalise = normalizeSearch(transcript);
  const numeroDicte = extraireNumeroTravail(transcript);
  const [animaux, groupes, types, medicaments, aliasesVocaux] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: { nutrav: true, nobovi: true },
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
  ]);

  let target: VoiceTarget | null = null;
  let candidates: Array<{ nutrav: string; nom: string | null }> = [];

  if (numeroDicte) {
    const exacts = animaux.filter((animal) => normaliserNumeroTravail(animal.nutrav) === numeroDicte);
    if (exacts.length === 1) {
      const animal = exacts[0];
      target = { kind: "animal", label: `${animal.nutrav}${animal.nobovi ? ` · ${animal.nobovi}` : ""}`, nutravs: [animal.nutrav] };
    } else {
      const chiffresDictes = numeroDicte.replace(/^0+/, "") || "0";
      candidates = animaux
        .filter((animal) => animal.nutrav.replace(/^0+/, "").endsWith(chiffresDictes))
        .map((animal) => ({ nutrav: animal.nutrav, nom: animal.nobovi }))
        .slice(0, 8);
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

  const temperature = extraireTemperature(texteNormalise);
  const event = trouverEvenement(texteNormalise, types, temperature);
  const reconnaissanceMedicament = trouverMedicament(texteNormalise, medicaments, aliasesVocaux);
  const medicament = reconnaissanceMedicament.medicament;
  const voieAdministration = trouverVoieAdministration(texteNormalise)
    ?? (medicament ? trouverVoieAdministration(normalizeSearch(medicament.nom)) : null);
  const pattes = extrairePattes(texteNormalise);
  const ajouterAuParage = /\b(?:ajout(?:e|er)?|mettre|mets)\b.*\bparage\b|\bliste de parage\b/.test(texteNormalise);
  const rappelDemande = /\b(?:rappel|rappeler|rappelle|surveiller|surveillance)\b/.test(texteNormalise);
  const traitementMentionne = /\btraitement\b/.test(texteNormalise) || medicament !== null;
  const estBoiterie = Boolean(event && normalizeSearch(event.nom) === "boiterie") || /\bboite(?:rie)?\b/.test(texteNormalise);

  const draft: VoiceSanitaryDraft = {
    transcript,
    target,
    event: event ? { id: event.id, nom: event.nom } : null,
    date: extraireDate(transcript, texteNormalise),
    moment: momentFrance(texteNormalise),
    temperature,
    pattes,
    ajouterAuParage,
    medicament: medicament ? { id: medicament.id, nom: medicament.nom } : null,
    medicamentEntendu: reconnaissanceMedicament.entendu,
    medicamentCandidates: reconnaissanceMedicament.candidates,
    voieAdministration,
    rappelDemande,
    traitementMentionne,
    description: transcript,
    suggestedActions: estBoiterie ? ["sanitaire", "parage"] : ["sanitaire"],
  };

  const informationSanitaire = Boolean(event || temperature !== null || medicament || reconnaissanceMedicament.candidates.length > 0 || ajouterAuParage || rappelDemande || traitementMentionne);
  if (candidates.length > 0 && informationSanitaire) {
    return NextResponse.json({ outcome: "confirm_animal", draft, candidates });
  }
  if (!target || !informationSanitaire) {
    const reason = numeroDicte && !target ? `Animal ${numeroDicte} non trouvé : note vocale conservée` : "Phrase trop imprécise : note vocale conservée";
    return NextResponse.json({ outcome: "note", reason });
  }
  if (draft.suggestedActions.length > 1) {
    return NextResponse.json({ outcome: "choose_action", draft });
  }
  return NextResponse.json({ outcome: "draft", draft });
}

export const dynamic = "force-dynamic";
