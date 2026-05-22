import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
