import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ordonnanceCompatibleDate } from "@/lib/vaccine-prescription-date";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nom = searchParams.get("nom")?.trim().toLowerCase();
  const dateInjection = searchParams.get("date");
  if (!nom || !dateInjection || !/^\d{4}-\d{2}-\d{2}$/.test(dateInjection) || Number.isNaN(Date.parse(dateInjection))) return NextResponse.json([]);

  const all = await prisma.ordonnance.findMany({
    where: { date: { lt: new Date(Date.parse(dateInjection) + 86_400_000) } },
    orderBy: { date: "desc" },
    take: 500,
    include: { medicaments: { select: { nomExtrait: true, medicament: { select: { nom: true } } } } },
  });
  const matches = all.filter((o) => {
    if (!ordonnanceCompatibleDate(o.date, dateInjection)) return false;
    const noms = [
      o.medicamentNom,
      ...o.medicaments.flatMap((item) => [item.nomExtrait, item.medicament.nom]),
    ].map((value) => value.toLowerCase()).filter(Boolean);
    return noms.some((value) => value.includes(nom) || nom.includes(value));
  });

  return NextResponse.json(matches.slice(0, 20));
}
