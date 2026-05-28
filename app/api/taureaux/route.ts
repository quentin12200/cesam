import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET() {
  const taureaux = await prisma.taureau.findMany({
    select: { id: true, nupere: true, nopere: true, present: true, traper: true },
    orderBy: { nopere: "asc" },
  });

  return NextResponse.json({ taureaux });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nupere, nopere, traper, present } = body;

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
        traper: traper?.trim() || null,
        present: present !== false,
        updatedAt: new Date(),
      },
    });

    const desc = `Taureau ${taureau.nopere ?? taureau.nupere} ajouté`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_TAUREAU", desc, { op: "delete", model: "taureau", id: taureau.id });
    } catch {}

    return NextResponse.json({ ...taureau, _undoId: undoId, _undoDesc: desc }, { status: 201 });
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

    const taureau = await prisma.taureau.findUnique({ where: { id } });
    if (!taureau) return NextResponse.json({ error: "Taureau non trouvé" }, { status: 404 });

    await prisma.taureau.delete({ where: { id } });

    const desc = `Taureau ${taureau.nopere ?? taureau.nupere} supprimé`;
    let undoId = "";
    try {
      undoId = await logAction("DELETE_TAUREAU", desc, {
        op: "create",
        model: "taureau",
        data: { id: taureau.id, nupere: taureau.nupere, nopere: taureau.nopere, traper: taureau.traper, present: taureau.present, updatedAt: new Date() },
      });
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch (err) {
    console.error("DELETE /api/taureaux error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
