import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gestationIdAEnregistrer } from "@/lib/vaccination-session";
import { medicamentCompatibleAvecEtape } from "@/lib/vaccine-attachment";
import { resynchroniserStatutProtocole } from "@/lib/vaccine-statut-sync";

/**
 * Rattache un ancien `Traitement` vaccinal à un protocole/une étape. Le traitement reste le fait
 * historique : seuls les champs de rattachement sont écrits, aucune `Vaccination` n'est créée et
 * le médicament, la date et la dose ne sont jamais modifiés.
 */
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

    const [traitement, protocole] = await Promise.all([
      prisma.traitement.findUnique({
        where: { id },
        select: { id: true, animalId: true, medicamentId: true, protocoleVaccinId: true, medicament: { select: { categorie: true } } },
      }),
      prisma.protocoleVaccin.findUnique({
        where: { id: protocoleId },
        select: {
          etapes: {
            select: { id: true, reference: true, medicaments: { select: { medicamentId: true } } },
          },
        },
      }),
    ]);
    if (!traitement || !protocole) {
      return NextResponse.json({ error: "Traitement ou protocole introuvable" }, { status: 404 });
    }
    if (!traitement.medicamentId || traitement.medicament?.categorie !== "VACCIN") {
      return NextResponse.json({ error: "Ce traitement n’est pas un vaccin" }, { status: 400 });
    }
    if (!protocole.etapes.some((etape) => etape.id === etapeProtocoleId)) {
      return NextResponse.json({ error: "Cette étape n’appartient pas à ce protocole" }, { status: 400 });
    }
    if (!medicamentCompatibleAvecEtape(protocole, etapeProtocoleId, traitement.medicamentId)) {
      return NextResponse.json({ error: "Le médicament réel ne correspond pas à cette étape" }, { status: 400 });
    }

    const gestationAEnregistrer = gestationIdAEnregistrer(protocole.etapes, gestationId);
    if (gestationAEnregistrer) {
      const gestation = await prisma.gestation.findFirst({
        where: { id: gestationAEnregistrer, saillie: { animalId: traitement.animalId } },
        select: { id: true },
      });
      if (!gestation) return NextResponse.json({ error: "Cycle de gestation invalide" }, { status: 400 });
    }

    await prisma.traitement.update({
      where: { id },
      data: {
        protocoleVaccinId: protocoleId,
        etapeProtocoleVaccinId: etapeProtocoleId,
        gestationId: gestationAEnregistrer,
      },
    });
    await resynchroniserStatutProtocole(traitement.animalId, protocoleId);
    if (traitement.protocoleVaccinId && traitement.protocoleVaccinId !== protocoleId) await resynchroniserStatutProtocole(traitement.animalId, traitement.protocoleVaccinId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/traitements/[id]/rattachement-vaccinal error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
