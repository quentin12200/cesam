import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fullNational, sameBullCandidates, canonicalName, canonicalNational } from "@/lib/bull-identity";

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
      // Si on ne connaît que quatre chiffres, refuser une fusion lorsque
      // plusieurs taureaux complets pourraient correspondre au même nom.
      if (confidence === "A_VERIFIER") {
        const possible = await tx.taureau.findMany({
          where: { nopere: { not: null } },
          select: { id: true, nupere: true, nopere: true },
        });
        const candidates = possible.filter((bull) =>
          fullNational(bull.nupere) &&
          canonicalNational(bull.nupere).endsWith(canonicalNational(remove.nupere).slice(-4)) &&
          canonicalName(bull.nopere) === canonicalName(remove.nopere)
        );
        if (candidates.length !== 1 || candidates[0].id !== keepId) {
          throw new Error("AMBIGUOUS");
        }
      }
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
      AMBIGUOUS: "Plusieurs identités possibles. Aucun lien n’a été modifié.",
    };
    return NextResponse.json({ error: messages[code] ?? "Fusion impossible. Aucune modification partielle n'a été conservée." }, { status: 409 });
  }
}
