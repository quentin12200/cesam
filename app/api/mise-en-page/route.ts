export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROFILS = ["Céline", "Samuel"];
const MODULES = ["accueil", "troupeau", "reproduction", "velage", "sanitaire", "pharmacie", "finances"];

function valide(profil: string | null, moduleId: string | null) {
  return !!profil && !!moduleId && PROFILS.includes(profil) && MODULES.includes(moduleId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profil = url.searchParams.get("profil");
  const moduleId = url.searchParams.get("module");
  if (!valide(profil, moduleId)) {
    return NextResponse.json({ error: "Profil ou module invalide" }, { status: 400 });
  }

  const preference = await prisma.miseEnPage.findUnique({
    where: { profil_module: { profil: profil!, module: moduleId! } },
  });

  return NextResponse.json({
    sections: preference ? JSON.parse(preference.sections) : null,
    updatedAt: preference?.updatedAt.toISOString() ?? null,
  });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const profil = typeof body?.profil === "string" ? body.profil : null;
  const moduleId = typeof body?.module === "string" ? body.module : null;
  const sections = Array.isArray(body?.sections) ? body.sections : null;

  if (!valide(profil, moduleId) || !sections) {
    return NextResponse.json({ error: "Préférence invalide" }, { status: 400 });
  }

  const nettoyees = sections
    .filter((section: unknown): section is { id: string; label: string; visible: boolean } => {
      if (!section || typeof section !== "object") return false;
      const value = section as Record<string, unknown>;
      return typeof value.id === "string" && typeof value.label === "string" && typeof value.visible === "boolean";
    })
    .map((section) => ({ id: section.id.slice(0, 80), label: section.label.slice(0, 120), visible: section.visible }));

  await prisma.miseEnPage.upsert({
    where: { profil_module: { profil: profil!, module: moduleId! } },
    create: { profil: profil!, module: moduleId!, sections: JSON.stringify(nettoyees) },
    update: { sections: JSON.stringify(nettoyees) },
  });

  return NextResponse.json({ ok: true });
}
