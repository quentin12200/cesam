import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normaliserPattes } from "@/lib/parage";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const animalIds: string[] = Array.isArray(body.animalIds)
    ? [...new Set<string>((body.animalIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const pattes = normaliserPattes(body.pattes);
  const motif = body.motif === "BOITERIE" ? "BOITERIE" : "PARAGE";
  const date = body.date ? new Date(body.date) : new Date();

  if (animalIds.length !== 1) {
    return NextResponse.json({ error: "Sélectionne une seule vache" }, { status: 400 });
  }
  if (pattes.length === 0) {
    return NextResponse.json({ error: "Sélectionne au moins une patte" }, { status: 400 });
  }
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const animaux = await prisma.animal.findMany({
    where: { id: { in: animalIds }, statut: "ACTIF", sexbov: "F" },
    select: { id: true },
  });
  if (animaux.length !== animalIds.length) {
    return NextResponse.json({ error: "Une vache sélectionnée est introuvable ou inactive" }, { status: 400 });
  }

  await prisma.parage.createMany({
    data: animaux.map((animal) => ({
      animalId: animal.id,
      date,
      motif,
      pattes: JSON.stringify(pattes),
      notes: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      statut: "A_VOIR",
    })),
  });

  return NextResponse.json({ count: animaux.length }, { status: 201 });
}
