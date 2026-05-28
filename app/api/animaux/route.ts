import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statut = searchParams.get("statut") ?? "ACTIF";
  const sexe = searchParams.get("sexe");
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);

  const where: Prisma.AnimalWhereInput = {};

  if (statut && (statut === "ACTIF" || statut === "SORTI")) where.statut = statut;
  if (sexe && (sexe === "F" || sexe === "M")) where.sexbov = sexe;
  if (q && q.trim()) {
    where.OR = [
      { nutrav: { contains: q.trim() } },
      { nobovi: { contains: q.trim() } },
      { nunati: { contains: q.trim() } },
    ];
  }

  const [total, animaux] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      orderBy: { nutrav: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        nunati: true,
        danais: true,
        sexbov: true,
        statut: true,
        estGenisse: true,
        race: true,
      },
    }),
  ]);

  return NextResponse.json({
    animaux,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nutrav, nunati, nobovi, danais, categorie, mereNutrav } = body;

    if (!nutrav?.trim() || !nunati?.trim() || !danais || !categorie) {
      return NextResponse.json(
        { error: "Champs manquants: nutrav, nunati, danais, categorie requis" },
        { status: 400 }
      );
    }

    // Vérifier unicité
    const [existNutrav, existNunati] = await Promise.all([
      prisma.animal.findUnique({ where: { nutrav: nutrav.trim() } }),
      prisma.animal.findUnique({ where: { nunati: nunati.trim() } }),
    ]);
    if (existNutrav) {
      return NextResponse.json({ error: "Ce N° Travail existe déjà" }, { status: 409 });
    }
    if (existNunati) {
      return NextResponse.json({ error: "Ce N° National existe déjà" }, { status: 409 });
    }

    // Résoudre la mère
    let mereId: string | null = null;
    if (mereNutrav?.trim()) {
      const mere = await prisma.animal.findUnique({
        where: { nutrav: mereNutrav.trim() },
        select: { id: true },
      });
      if (!mere) {
        return NextResponse.json({ error: `Mère introuvable : ${mereNutrav}` }, { status: 404 });
      }
      mereId = mere.id;
    }

    const sexbov = categorie === "male" ? "M" : "F";
    const estGenisse = categorie === "genisse";

    const animal = await prisma.animal.create({
      data: {
        nutrav: nutrav.trim(),
        nunati: nunati.trim(),
        nobovi: nobovi?.trim() || null,
        danais: new Date(danais),
        sexbov,
        estGenisse,
        mereId,
        updatedAt: new Date(),
      },
    });

    const desc = `Animal ${animal.nutrav}${animal.nobovi ? ` (${animal.nobovi})` : ''} ajouté`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_ANIMAL", desc, { op: "delete", model: "animal", id: animal.id });
    } catch {}

    return NextResponse.json({ nutrav: animal.nutrav, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/animaux error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

