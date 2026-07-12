import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.evenementSymptome.groupBy({
    by: ["libelle", "groupe"],
    _count: { libelle: true },
    orderBy: { _count: { libelle: "desc" } },
    take: 12,
  });

  return NextResponse.json(
    rows.map((r) => ({ libelle: r.libelle, groupe: r.groupe, count: r._count.libelle }))
  );
}
