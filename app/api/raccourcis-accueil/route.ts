export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACCUEIL_SHORTCUTS, normaliserAccueilShortcuts } from "@/lib/accueil-shortcuts";

const PROFILS = ["Céline", "Samuel"];

function profilValide(profil: unknown): profil is string {
  return typeof profil === "string" && PROFILS.includes(profil);
}

function lireRaccourcis(value: string | null | undefined) {
  if (!value) return DEFAULT_ACCUEIL_SHORTCUTS;
  try {
    return normaliserAccueilShortcuts(JSON.parse(value));
  } catch {
    return DEFAULT_ACCUEIL_SHORTCUTS;
  }
}

export async function GET(request: Request) {
  const profil = new URL(request.url).searchParams.get("profil");
  if (!profilValide(profil)) return NextResponse.json({ error: "Profil invalide" }, { status: 400 });

  const preference = await prisma.miseEnPage.findUnique({
    where: { profil_module: { profil, module: "accueil" } },
    select: { raccourcis: true },
  });

  return NextResponse.json({ raccourcis: lireRaccourcis(preference?.raccourcis) });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!profilValide(body?.profil) || !Array.isArray(body?.raccourcis)) {
    return NextResponse.json({ error: "Préférence invalide" }, { status: 400 });
  }

  const raccourcis = normaliserAccueilShortcuts(body.raccourcis);
  await prisma.miseEnPage.upsert({
    where: { profil_module: { profil: body.profil, module: "accueil" } },
    create: { profil: body.profil, module: "accueil", sections: "[]", raccourcis: JSON.stringify(raccourcis) },
    update: { raccourcis: JSON.stringify(raccourcis) },
  });

  return NextResponse.json({ ok: true, raccourcis });
}
