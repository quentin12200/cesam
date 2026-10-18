import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIBELLES_CATEGORIES_VACCINS } from "@/lib/vaccine-category-selection";

class CiblageObsolete extends Error {}

/** Modifie exclusivement les catégories d'un protocole historique.
 * Les étapes, les traitements, les actes vaccinaux et leurs statuts ne sont jamais écrits.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 }); }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  const entree = body as { categories?: unknown; expectedCategoriesJson?: unknown };
  if (!Array.isArray(entree.categories) || !entree.categories.every(
    (code: unknown) => typeof code === "string" && Object.hasOwn(LIBELLES_CATEGORIES_VACCINS, code),
  )) {
    return NextResponse.json({ error: "Catégories inconnues" }, { status: 400 });
  }
  const categories = entree.categories as string[];
  if (new Set(categories).size !== categories.length || categories.length > Object.keys(LIBELLES_CATEGORIES_VACCINS).length) {
    return NextResponse.json({ error: "Catégories en doublon" }, { status: 400 });
  }
  if (!("expectedCategoriesJson" in entree) || (entree.expectedCategoriesJson !== null
    && typeof entree.expectedCategoriesJson !== "string")) {
    return NextResponse.json({ error: "Version précédente du ciblage requise" }, { status: 400 });
  }
  const precedent = entree.expectedCategoriesJson as string | null;
  const cibleNouvelle = JSON.stringify(categories);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const actuel = await tx.protocoleVaccin.findUnique({
        where: { id }, select: { id: true, label: true, categoriesJson: true, configurationQuestionnaireJson: true },
      });
      if (!actuel) return { statut: 404 as const, error: "Protocole non trouvé" };
      if (actuel.configurationQuestionnaireJson !== null) {
        return { statut: 409 as const, error: "Ce protocole se modifie depuis son questionnaire." };
      }
      if (actuel.categoriesJson !== precedent) {
        return { statut: 409 as const, error: "Le protocole a changé depuis l'ouverture. Recharge la page." };
      }
      if (cibleNouvelle === actuel.categoriesJson || (!categories.length && actuel.categoriesJson === null)) {
        return { statut: 200 as const, categories };
      }
      // Condition sur la valeur ancienne pour empêcher l'écrasement d'un réglage concurrent.
      const miseAJour = await tx.protocoleVaccin.updateMany({
        where: { id, categoriesJson: precedent, configurationQuestionnaireJson: null },
        data: { categoriesJson: cibleNouvelle },
      });
      if (miseAJour.count !== 1) throw new CiblageObsolete();
      await tx.actionLog.create({
        data: {
          type: "PATCH_CATEGORIES_PROTOCOLE",
          description: `Catégories du protocole ${actuel.label} mises à jour`,
          revertData: JSON.stringify({
            op: "update", model: "protocoleVaccin", where: { id },
            data: { categoriesJson: actuel.categoriesJson },
          }),
        },
      });
      return { statut: 200 as const, categories };
    });
    if (resultat.statut !== 200) {
      return NextResponse.json({ error: resultat.error }, { status: resultat.statut });
    }
    return NextResponse.json({ ok: true, categories: resultat.categories });
  } catch (error) {
    if (error instanceof CiblageObsolete) {
      return NextResponse.json({ error: "Le ciblage a changé entre-temps. Recharge la page." }, { status: 409 });
    }
    return NextResponse.json({ error: "Impossible de mettre à jour les catégories. Aucune étape sanitaire modifiée." }, { status: 500 });
  }
}
