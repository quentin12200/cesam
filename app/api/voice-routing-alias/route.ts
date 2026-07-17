import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSearch } from "@/lib/fuzzy-search";
import type { VoiceActionId } from "@/lib/voice-actions";

const ACTIONS: VoiceActionId[] = ["sanitaire", "parage", "saillie"];

function normaliserPhraseAiguillage(phrase: string) {
  return normalizeSearch(phrase)
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
  const action = typeof body.action === "string" ? body.action as VoiceActionId : null;
  const phraseNormalisee = normaliserPhraseAiguillage(phrase);

  if (!phraseNormalisee || !action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Correction invalide" }, { status: 400 });
  }

  const alias = await prisma.voiceRoutingAlias.upsert({
    where: { phraseNormalisee },
    create: { phrase, phraseNormalisee, action },
    update: { phrase, action, confirmations: { increment: 1 } },
  });
  return NextResponse.json(alias);
}

export const dynamic = "force-dynamic";
