import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const velage = await prisma.velage.findUnique({
      where: { id },
      include: {
        veau: { select: { nutrav: true } },
        vache: { select: { nutrav: true } },
        gestation: { select: { id: true } },
      },
    });

    if (!velage) {
      return NextResponse.json({ error: "Vêlage introuvable" }, { status: 404 });
    }

    await prisma.velage.delete({ where: { id } });

    if (velage.veau) {
      await prisma.animal.update({
        where: { nutrav: velage.veau.nutrav },
        data: { mereId: null, danais: null as unknown as undefined },
      });
    }

    if (velage.gestation) {
      await prisma.gestation.update({
        where: { id: velage.gestation.id },
        data: { etat: "VERT" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/velages/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { veauNutrav, veauSexe, veauNom } = body;

    if (!veauNutrav) {
      return NextResponse.json({ error: "veauNutrav requis" }, { status: 400 });
    }

    const velage = await prisma.velage.findUnique({
      where: { id },
      include: { vache: true },
    });
    if (!velage) {
      return NextResponse.json({ error: "Vêlage introuvable" }, { status: 404 });
    }
    if (velage.veauId) {
      return NextResponse.json({ error: "Ce vêlage a déjà un veau lié" }, { status: 409 });
    }

    const sexe = veauSexe ?? "F";
    const estFemelle = sexe === "F";

    // Chercher ou créer le veau
    let veau = await prisma.animal.findUnique({ where: { nutrav: veauNutrav } });
    let cree = false;
    if (!veau) {
      veau = await prisma.animal.create({
        data: {
          nutrav: veauNutrav,
          nunati: `AUTO${veauNutrav}`,
          nobovi: veauNom ?? null,
          danais: velage.date,
          sexbov: sexe,
          statut: "ACTIF",
          estGenisse: estFemelle,
          categorie: estFemelle ? "VELLE" : null,
          mereId: velage.vacheId,
        },
      });
      cree = true;
    } else {
      const updateData: Record<string, unknown> = { mereId: velage.vacheId, danais: velage.date };
      if (veauSexe) updateData.sexbov = veauSexe;
      if (veauNom) updateData.nobovi = veauNom;
      await prisma.animal.update({ where: { nutrav: veauNutrav }, data: updateData });
    }

    await prisma.velage.update({
      where: { id },
      data: { veauId: veau.id },
    });

    return NextResponse.json({ success: true, veauNutrav, cree });
  } catch (err) {
    console.error("PATCH /api/velages/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
