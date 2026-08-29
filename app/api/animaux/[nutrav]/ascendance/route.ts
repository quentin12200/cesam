import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAncestryUpdate,
  rankAncestryMatches,
  workNumberFromHistoricalNational,
  type AncestryParent,
  type AncestrySearchMatch,
  type AncestrySource,
} from "@/lib/animal-genealogy";
import { findAnimalsByExactNational, normalizeGenealogyNational } from "@/lib/animal-genealogy-data";

function includes(value: string | null | undefined, query: string) {
  if (!value) return false;
  return value.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))
    || normalizeGenealogyNational(value).includes(normalizeGenealogyNational(query));
}

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const parent = new URL(request.url).searchParams.get("parent") as AncestryParent | null;
  if (!query || !["MERE", "PERE"].includes(parent ?? "")) {
    return NextResponse.json({ matches: [] });
  }
  const searchTerms = [...new Set([
    query,
    query.replace(/\s+/g, ""),
    normalizeGenealogyNational(query),
  ].filter(Boolean))];

  const [animals, bulls, calvings] = await Promise.all([
    prisma.animal.findMany({
      where: {
        OR: searchTerms.flatMap((term) => [
          { nutrav: { contains: term } },
          { nunati: { contains: term } },
          { numeroNational: { contains: term } },
          { nobovi: { contains: term } },
          { numeip: { contains: term } },
          { nomeip: { contains: term } },
        ]),
      },
      take: 20,
      select: {
        id: true,
        nutrav: true,
        nunati: true,
        numeroNational: true,
        nobovi: true,
        statut: true,
        numeip: true,
        nomeip: true,
      },
    }),
    parent === "PERE"
      ? prisma.taureau.findMany({
          where: { OR: searchTerms.flatMap((term) => [{ nupere: { contains: term } }, { nopere: { contains: term } }]) },
          take: 12,
          select: { id: true, nupere: true, nopere: true, present: true },
        })
      : Promise.resolve([]),
    parent === "PERE"
      ? prisma.velage.findMany({
          where: { OR: searchTerms.flatMap((term) => [{ pereNunati: { contains: term } }, { pereNom: { contains: term } }]) },
          take: 12,
          select: { id: true, pereNunati: true, pereNom: true },
        })
      : Promise.resolve([]),
  ]);

  const historicalNumbers = [
    ...animals.map((animal) => animal.numeip),
    ...calvings.map((calving) => calving.pereNunati),
  ].filter((value): value is string => Boolean(value));
  const linkedByNational = await findAnimalsByExactNational(historicalNumbers);

  const matches: AncestrySearchMatch[] = [];
  for (const animal of animals) {
    if ([animal.nutrav, animal.nunati, animal.numeroNational, animal.nobovi].some((value) => includes(value, query))) {
      matches.push({
        key: `animal-${animal.id}`,
        source: "ANIMAL",
        sourceId: animal.id,
        workNumber: animal.nutrav,
        nationalNumber: animal.numeroNational ?? animal.nunati,
        name: animal.nobovi,
        status: animal.statut,
      });
    }
    if (parent === "MERE" && [animal.numeip, animal.nomeip].some((value) => includes(value, query))) {
      const linked = linkedByNational.get(normalizeGenealogyNational(animal.numeip));
      matches.push({
        key: `historique-${animal.id}-${animal.numeip ?? animal.nomeip}`,
        source: linked ? "ANIMAL" : "HISTORIQUE",
        sourceId: linked?.id ?? null,
        workNumber: linked?.nutrav ?? workNumberFromHistoricalNational(animal.numeip),
        nationalNumber: animal.numeip,
        name: animal.nomeip,
        status: linked?.status ?? null,
      });
    }
  }
  for (const bull of bulls) {
    matches.push({
      key: `taureau-${bull.id}`,
      source: "TAUREAU",
      sourceId: bull.id,
      workNumber: workNumberFromHistoricalNational(bull.nupere),
      nationalNumber: bull.nupere,
      name: bull.nopere,
      status: bull.present ? "ACTIF" : "SORTI",
    });
  }
  for (const calving of calvings) {
    const linked = linkedByNational.get(normalizeGenealogyNational(calving.pereNunati));
    matches.push({
      key: `velage-${calving.id}`,
      source: linked ? "ANIMAL" : "VELAGE",
      sourceId: linked?.id ?? null,
      workNumber: linked?.nutrav ?? workNumberFromHistoricalNational(calving.pereNunati),
      nationalNumber: calving.pereNunati,
      name: calving.pereNom,
      status: linked?.status ?? null,
    });
  }

  const uniqueMatches = [...new Map(matches.map((match) => [
    `${match.source}:${match.sourceId ?? ""}:${match.workNumber ?? ""}:${match.nationalNumber ?? ""}:${match.name ?? ""}`,
    match,
  ])).values()];
  return NextResponse.json({ matches: rankAncestryMatches(uniqueMatches, query).slice(0, 12) });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nutrav: string }> },
) {
  const { nutrav } = await context.params;
  const body = await request.json().catch(() => null);
  const parent = body?.parent as AncestryParent | undefined;
  const source = body?.source as AncestrySource | "MANUEL" | undefined;
  if (!parent || !["MERE", "PERE"].includes(parent) || !source) {
    return NextResponse.json({ error: "Ascendance invalide." }, { status: 400 });
  }

  let sourceId = typeof body.sourceId === "string" ? body.sourceId : null;
  let workNumber = typeof body.workNumber === "string" ? body.workNumber.trim() : "";
  let nationalNumber = typeof body.nationalNumber === "string" ? body.nationalNumber.trim() || null : null;
  let name = typeof body.name === "string" ? body.name.trim() || null : null;

  if (source === "ANIMAL" && sourceId) {
    const animal = await prisma.animal.findUnique({
      where: { id: sourceId },
      select: { nutrav: true, nunati: true, numeroNational: true, nobovi: true },
    });
    if (!animal) return NextResponse.json({ error: "Parent introuvable." }, { status: 404 });
    workNumber = animal.nutrav;
    nationalNumber = animal.numeroNational ?? animal.nunati;
    name = animal.nobovi;
  } else if (source === "TAUREAU" && sourceId) {
    const bull = await prisma.taureau.findUnique({
      where: { id: sourceId },
      select: { nupere: true, nopere: true },
    });
    if (!bull) return NextResponse.json({ error: "Père introuvable." }, { status: 404 });
    nationalNumber = bull.nupere;
    name = bull.nopere;
  } else {
    sourceId = null;
    if (!workNumber) {
      return NextResponse.json({ error: "Le N° de travail est requis." }, { status: 400 });
    }
  }

  const data = buildAncestryUpdate({ parent, source, sourceId, workNumber, nationalNumber, name });
  const animal = await prisma.animal.update({ where: { nutrav }, data });
  return NextResponse.json({ ok: true, nutrav: animal.nutrav });
}
