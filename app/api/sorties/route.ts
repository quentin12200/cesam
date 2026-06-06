import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const annee = searchParams.get("annee");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (annee) {
      const year = parseInt(annee);
      where.date = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }

    const sorties = await prisma.sortie.findMany({
      where,
      include: {
        animal: {
          select: { nutrav: true, nobovi: true, sexbov: true, danais: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(sorties);
  } catch (err) {
    console.error("GET /api/sorties error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      animalId,
      date,
      type,
      acheteur,
      prixKilo,
      poids,
      poidsVif,
      rendementCarcasse,
      prixDefinitifHT,
      dateDebutEngr,
      notes,
      causeMortalite,
    } = body;

    if (!animalId || !date || !type) {
      return NextResponse.json(
        { error: "Champs manquants: animalId, date, type requis" },
        { status: 400 }
      );
    }

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { nutrav: true, nobovi: true },
    });

    const prixPrevuHT =
      prixKilo && poids ? Math.round(prixKilo * poids * 100) / 100 : null;

    const sortie = await prisma.sortie.create({
      data: {
        animalId,
        date: new Date(date),
        type,
        acheteur: acheteur ?? null,
        prixKilo: prixKilo ? parseFloat(prixKilo) : null,
        poids: poids ? parseFloat(poids) : null,
        poidsVif: poidsVif ? parseFloat(poidsVif) : null,
        rendementCarcasse: rendementCarcasse ? parseFloat(rendementCarcasse) : null,
        prixPrevuHT,
        prixDefinitifHT: prixDefinitifHT ? parseFloat(prixDefinitifHT) : null,
        dateDebutEngr: dateDebutEngr ? new Date(dateDebutEngr) : null,
        notes: notes ?? null,
        causeMortalite: type === "MORT" ? (causeMortalite ?? null) : null,
        updatedAt: new Date(),
      },
    });

    await prisma.animal.update({
      where: { id: animalId },
      data: { statut: "SORTI", updatedAt: new Date() },
    });

    const desc = `Sortie ${type.toLowerCase()} : ${animal?.nobovi ?? animal?.nutrav ?? animalId}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_SORTIE", desc, [
        { op: "delete", model: "sortie", id: sortie.id },
        { op: "update", model: "animal", where: { id: animalId }, data: { statut: "ACTIF" } },
      ]);
    } catch {}

    return NextResponse.json({ ...sortie, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sorties error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
