import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nom = searchParams.get("nom")?.trim().toLowerCase();
  if (!nom) return NextResponse.json([]);

  const all = await prisma.ordonnance.findMany({
    orderBy: { date: "desc" },
    take: 500,
    include: { medicaments: { select: { nomExtrait: true, medicament: { select: { nom: true } } } } },
  });
  const matches = all.filter((o) => {
    const noms = [
      o.medicamentNom,
      ...o.medicaments.flatMap((item) => [item.nomExtrait, item.medicament.nom]),
    ].map((value) => value.toLowerCase()).filter(Boolean);
    return noms.some((value) => value.includes(nom) || nom.includes(value));
  });

  return NextResponse.json(matches.slice(0, 20));
}
