import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.statsAnnuelle.findMany({ orderBy: { annee: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { annee, veauxCount, veauxKgTotal, veauxPrixMoyen, veauxCA, vachesCount, vachesKgCarcasse, vachesPrixMoyen, vachesCA, velagesCount } = body;

    if (!annee) return NextResponse.json({ error: "Année requise" }, { status: 400 });

    const row = await prisma.statsAnnuelle.upsert({
      where: { annee: parseInt(annee) },
      create: {
        id: `hist-${annee}`,
        annee: parseInt(annee),
        veauxCount: parseInt(veauxCount) || 0,
        veauxKgTotal: parseFloat(veauxKgTotal) || 0,
        veauxPrixMoyen: veauxPrixMoyen ? parseFloat(veauxPrixMoyen) : null,
        veauxCA: parseFloat(veauxCA) || 0,
        vachesCount: parseInt(vachesCount) || 0,
        vachesKgCarcasse: parseFloat(vachesKgCarcasse) || 0,
        vachesPrixMoyen: vachesPrixMoyen ? parseFloat(vachesPrixMoyen) : null,
        vachesCA: parseFloat(vachesCA) || 0,
        velagesCount: parseInt(velagesCount) || 0,
        updatedAt: new Date(),
      },
      update: {
        veauxCount: parseInt(veauxCount) || 0,
        veauxKgTotal: parseFloat(veauxKgTotal) || 0,
        veauxPrixMoyen: veauxPrixMoyen ? parseFloat(veauxPrixMoyen) : null,
        veauxCA: parseFloat(veauxCA) || 0,
        vachesCount: parseInt(vachesCount) || 0,
        vachesKgCarcasse: parseFloat(vachesKgCarcasse) || 0,
        vachesPrixMoyen: vachesPrixMoyen ? parseFloat(vachesPrixMoyen) : null,
        vachesCA: parseFloat(vachesCA) || 0,
        velagesCount: parseInt(velagesCount) || 0,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(row);
  } catch (err) {
    console.error("POST /api/stats-annuelles error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { annee } = await req.json();
    await prisma.statsAnnuelle.delete({ where: { annee: parseInt(annee) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/stats-annuelles error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
