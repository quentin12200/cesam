import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compactVoiceText } from "@/lib/voice-sanitary";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const transcription = typeof body.transcription === "string" ? body.transcription.trim() : "";
  const medicamentId = typeof body.medicamentId === "string" ? body.medicamentId : "";
  const alias = compactVoiceText(transcription);
  if (!medicamentId || alias.length < 3) {
    return NextResponse.json({ error: "Correction incomplète" }, { status: 400 });
  }

  const medicament = await prisma.medicament.findFirst({ where: { id: medicamentId, actif: true }, select: { id: true } });
  if (!medicament) return NextResponse.json({ error: "Médicament introuvable" }, { status: 404 });

  const existant = await prisma.medicamentAliasVocal.findUnique({ where: { alias } });
  const correction = existant
    ? await prisma.medicamentAliasVocal.update({
        where: { alias },
        data: {
          transcription,
          medicamentId,
          confirmations: existant.medicamentId === medicamentId ? { increment: 1 } : 1,
        },
      })
    : await prisma.medicamentAliasVocal.create({ data: { alias, transcription, medicamentId } });

  return NextResponse.json({ id: correction.id, alias: correction.alias });
}

export const dynamic = "force-dynamic";
