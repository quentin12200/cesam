import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gestationIdAEnregistrer } from "@/lib/vaccination-session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const protocoleId = typeof body.protocoleId === "string" ? body.protocoleId : "";
    const etapeProtocoleId = typeof body.etapeProtocoleId === "string" ? body.etapeProtocoleId : "";
    const gestationId = typeof body.gestationId === "string" && body.gestationId ? body.gestationId : null;
    if (!protocoleId || !etapeProtocoleId) {
      return NextResponse.json({ error: "Protocole et étape requis" }, { status: 400 });
    }

    const [vaccination, protocole] = await Promise.all([
      prisma.vaccination.findUnique({
        where: { id },
        select: { id: true, animalId: true, medicamentId: true, gestationId: true },
      }),
      prisma.protocoleVaccin.findUnique({
        where: { id: protocoleId },
        select: {
          etapes: {
            select: {
              id: true,
              ordre: true,
              cycle: true,
              reference: true,
              medicaments: { select: { medicamentId: true } },
            },
          },
        },
      }),
    ]);
    const etape = protocole?.etapes.find((item) => item.id === etapeProtocoleId);
    if (!vaccination || !protocole || !etape) {
      return NextResponse.json({ error: "Vaccination, protocole ou étape introuvable" }, { status: 404 });
    }
    const medicamentLieDirectement = vaccination.medicamentId
      ? etape.medicaments.some((liaison) => liaison.medicamentId === vaccination.medicamentId)
      : true;
    const medicamentLieAuProtocole = vaccination.medicamentId
      ? protocole.etapes.some((item) => item.medicaments.some((liaison) => liaison.medicamentId === vaccination.medicamentId))
      : true;
    const medicamentCompatible = medicamentLieDirectement
      || (etape.medicaments.length === 0 && medicamentLieAuProtocole);
    if (!medicamentCompatible) {
      return NextResponse.json({ error: "Le médicament réel ne correspond pas à cette étape" }, { status: 400 });
    }
    if (gestationId) {
      const gestation = await prisma.gestation.findFirst({
        where: { id: gestationId, saillie: { animalId: vaccination.animalId } },
        select: { id: true },
      });
      if (!gestation) return NextResponse.json({ error: "Cycle de gestation invalide" }, { status: 400 });
    }

    await prisma.vaccination.update({
      where: { id },
      data: {
        protocoleId,
        etapeProtocoleId,
        gestationId: vaccination.gestationId
          ?? gestationIdAEnregistrer(protocole.etapes, gestationId),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/vaccinations/[id]/rattachement error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
