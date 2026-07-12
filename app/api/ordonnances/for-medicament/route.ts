import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nom = searchParams.get("nom")?.trim().toLowerCase();
  if (!nom) return NextResponse.json([]);

  const all = await prisma.ordonnance.findMany({ orderBy: { date: "desc" }, take: 500 });
  const matches = all.filter((o) => {
    const on = o.medicamentNom.toLowerCase();
    return on.length > 0 && (on.includes(nom) || nom.includes(on));
  });

  return NextResponse.json(matches.slice(0, 20));
}
