import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalIds, nutravs, date, moment, categorie, type, symptomes, temperature, description, photos, constatePar } = body;

    if (!type?.trim() || !date) {
      return NextResponse.json({ error: "type et date requis" }, { status: 400 });
    }

    const symptomesList: { libelle: string; groupe?: string | null }[] = Array.isArray(symptomes)
      ? symptomes.filter((s: { libelle?: string }) => s?.libelle?.trim()).map((s: { libelle: string; groupe?: string | null }) => ({ libelle: s.libelle.trim(), groupe: s.groupe ?? null }))
      : [];

    let ids: string[] = Array.isArray(animalIds) ? animalIds : [];
    if (ids.length === 0 && Array.isArray(nutravs) && nutravs.length > 0) {
      const animaux = await prisma.animal.findMany({
        where: { nutrav: { in: nutravs } },
        select: { id: true },
      });
      ids = animaux.map((a) => a.id);
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "animalIds ou nutravs requis" }, { status: 400 });
    }

    const resolvedDate = new Date(date);
    const now = new Date();

    const evenements = await Promise.all(
      ids.map((animalId: string) =>
        prisma.evenementSanitaire.create({
          data: {
            animalId,
            categorie: categorie ?? null,
            type: type.trim(),
            date: resolvedDate,
            moment: moment ?? null,
            temperature: temperature != null && temperature !== "" ? Number(temperature) : null,
            description: description?.trim() || null,
            photos: photos ?? null,
            constatePar: constatePar?.trim() || null,
            updatedAt: now,
            ...(symptomesList.length > 0
              ? { symptomes: { create: symptomesList.map((s) => ({ libelle: s.libelle, groupe: s.groupe ?? null })) } }
              : {}),
          },
        })
      )
    );

    const desc = `Événement sanitaire "${type.trim()}" enregistré pour ${evenements.length} animal(s)`;
    let undoId = "";
    try {
      undoId = await logAction(
        "BATCH_EVENEMENT_SANITAIRE",
        desc,
        evenements.map((e) => ({ op: "delete" as const, model: "evenementSanitaire", id: e.id }))
      );
    } catch {}

    return NextResponse.json({
      count: evenements.length,
      evenements: evenements.map((e) => ({ id: e.id, animalId: e.animalId })),
      _undoId: undoId,
      _undoDesc: desc,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/evenements/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
