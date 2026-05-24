import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const taureaux = await prisma.taureau.findMany({
    select: { id: true, nupere: true, nopere: true, present: true },
    orderBy: { nopere: "asc" },
  });

  return NextResponse.json({ taureaux });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nupere, nopere } = body;

    if (!nupere?.trim()) {
      return NextResponse.json({ error: "Le numéro du taureau est requis" }, { status: 400 });
    }

    const existing = await prisma.taureau.findUnique({ where: { nupere: nupere.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Ce numéro existe déjà" }, { status: 409 });
    }

    const taureau = await prisma.taureau.create({
      data: {
        nupere: nupere.trim(),
        nopere: nopere?.trim() || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(taureau, { status: 201 });
  } catch (err) {
    console.error("POST /api/taureaux error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const sailliesCount = await prisma.saillie.count({ where: { taureauId: id } });
    if (sailliesCount > 0) {
      return NextResponse.json(
        { error: `Impossible : lié à ${sailliesCount} saillie(s)` },
        { status: 409 }
      );
    }

    await prisma.taureau.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/taureaux error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
