import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fullNational, sameBullCandidates } from "@/lib/bull-identity";

// Fusion explicitement demandée dans le répertoire ; jamais déclenchée
// depuis la recherche de filiation. Réaffectation atomique des liens.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const keepId = typeof body?.keepId === "string" ? body.keepId : "";
  const removeId = typeof body?.removeId === "string" ? body.removeId : "";
  if (!keepId || !removeId || keepId === removeId || body?.confirmation !== "FUSIONNER") {
    return NextResponse.json({ error: "Confirmation de fusion invalide." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bulls = await tx.taureau.findMany({
        where: { id: { in: [keepId, removeId] } },
        select: { id: true, nupere: true, nopere: true, present: true },
      });
      const keep = bulls.find((bull) => bull.id === keepId);
      const remove = bulls.find((bull) => bull.id === removeId);
      if (!keep || !remove) throw new Error("NOT_FOUND");
      // Le numéro de référence conservé doit être complet pour éviter
      // qu'une fiche courte remplace une identité mieux documentée.
      if (!fullNational(keep.nupere)) throw new Error("KEEP_FULL_NATIONAL");
      const confidence = sameBullCandidates(keep, remove);
      if (!confidence) throw new Error("CONFLICT");
      // En cas de correspondance probable, le nom et les 4 chiffres
      // doivent concorder (vérifié par sameBullCandidates).
      const animals = await tx.animal.updateMany({
        where: { taureauId: removeId },
        data: { taureauId: keepId },
      });
      const breedings = await tx.saillie.updateMany({
        where: { taureauId: removeId },
        data: { taureauId: keepId },
      });
      // Les références textuelles historiques restent intactes. Les
      // descendants et saillies déjà liés sont préservés par les updates.
      await tx.taureau.delete({ where: { id: removeId } });
      return { animalsRelinked: animals.count, breedingsRelinked: breedings.count, confidence };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      NOT_FOUND: "Une fiche a disparu ; recharge la page.",
      KEEP_FULL_NATIONAL: "Conserve la fiche ayant un numéro national complet.",
      CONFLICT: "Correspondance insuffisante : fusion refusée pour protéger la généalogie.",
    };
    return NextResponse.json({ error: messages[code] ?? "Fusion impossible. Aucune modification partielle n'a été conservée." }, { status: 409 });
  }
}
