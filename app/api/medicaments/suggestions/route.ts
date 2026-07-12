import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const libelles = (searchParams.get("symptomes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (libelles.length === 0) {
    return NextResponse.json([]);
  }

  const traitements = await prisma.traitement.findMany({
    where: {
      medicamentId: { not: null },
      OR: [
        { evenement: { symptomes: { some: { libelle: { in: libelles } } } } },
        { evenement: { type: { in: libelles } } },
      ],
    },
    select: { medicamentId: true },
  });

  const counts = new Map<string, number>();
  for (const t of traitements) {
    if (!t.medicamentId) continue;
    counts.set(t.medicamentId, (counts.get(t.medicamentId) ?? 0) + 1);
  }

  if (counts.size === 0) return NextResponse.json([]);

  const medicaments = await prisma.medicament.findMany({
    where: { id: { in: [...counts.keys()] }, actif: true },
  });

  const ranked = medicaments
    .map((m) => ({ ...m, _count: counts.get(m.id) ?? 0 }))
    .sort((a, b) => b._count - a._count);

  return NextResponse.json(ranked);
}
