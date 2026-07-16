import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch, searchTypesEvenement, type RecherchableTypeEvenement } from "@/lib/fuzzy-search";
import {
  extraireNumeroTravail,
  extrairePattes,
  extraireTemperature,
  normaliserNumeroTravail,
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

function trouverMedicament(texteNormalise: string, medicaments: Array<{ id: string; nom: string; dci: string | null }>) {
  const correspondances = medicaments
    .map((medicament) => {
      const noms = [normalizeSearch(medicament.nom), medicament.dci ? normalizeSearch(medicament.dci) : ""].filter((nom) => nom.length >= 3);
      const longueur = Math.max(0, ...noms.filter((nom) => texteNormalise.includes(nom)).map((nom) => nom.length));
      return { medicament, longueur };
    })
    .filter(({ longueur }) => longueur > 0)
    .sort((a, b) => b.longueur - a.longueur);
  return correspondances[0]?.medicament ?? null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transcript = typeof body.texte === "string" ? body.texte.trim() : "";
  if (!transcript) return NextResponse.json({ error: "texte requis" }, { status: 400 });

  const texteNormalise = normalizeSearch(transcript);
  const numeroDicte = extraireNumeroTravail(transcript);
  const [animaux, groupes, types, medicaments] = await Promise.all([
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
  const medicament = trouverMedicament(texteNormalise, medicaments);
  const pattes = extrairePattes(texteNormalise);
  const ajouterAuParage = /\b(?:ajout(?:e|er)?|mettre|mets)\b.*\bparage\b|\bliste de parage\b/.test(texteNormalise);
  const rappelDemande = /\b(?:rappel|rappeler|rappelle|surveiller|surveillance)\b/.test(texteNormalise);
  const traitementMentionne = /\btraitement\b/.test(texteNormalise) || medicament !== null;

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
    rappelDemande,
    traitementMentionne,
    description: transcript,
  };

  const informationSanitaire = Boolean(event || temperature !== null || medicament || ajouterAuParage || rappelDemande || traitementMentionne);
  if (candidates.length > 0 && informationSanitaire) {
    return NextResponse.json({ outcome: "confirm_animal", draft, candidates });
  }
  if (!target || !informationSanitaire) {
    const reason = numeroDicte && !target ? `Animal ${numeroDicte} non trouvé : note vocale conservée` : "Phrase trop imprécise : note vocale conservée";
    return NextResponse.json({ outcome: "note", reason });
  }
  return NextResponse.json({ outcome: "draft", draft });
}

export const dynamic = "force-dynamic";
