import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_MEDICAMENT, normaliserLibelleCategorie, valeurCategoriePersonnalisee } from "@/lib/medicament-categories";

/** Renomme une catégorie sur toutes les fiches sans migration de schéma. */
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ancienCode = typeof body?.ancienCode === "string" ? body.ancienCode : "";
  const nouveauNom = typeof body?.nouveauNom === "string" ? valeurCategoriePersonnalisee(body.nouveauNom) : "";
  if (!ancienCode || !nouveauNom || nouveauNom.length > 80 || ancienCode === "AUTRE") {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }
  // Les codes historiques sont partagés par d'autres fonctionnalités (vaccins, etc.).
  if (CATEGORIES_MEDICAMENT.some((c) => c.code === ancienCode)) {
    return NextResponse.json({ error: "Les catégories standard ne peuvent pas être renommées globalement." }, { status: 400 });
  }
  const categories = await prisma.medicament.findMany({ select: { categorie: true }, distinct: ["categorie"] });
  if (!categories.some((c) => c.categorie === ancienCode)) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
  const collision = categories.some((c) => c.categorie !== ancienCode && normaliserLibelleCategorie(c.categorie) === normaliserLibelleCategorie(nouveauNom))
    || CATEGORIES_MEDICAMENT.some((c) => normaliserLibelleCategorie(c.label) === normaliserLibelleCategorie(nouveauNom));
  if (collision) return NextResponse.json({ error: "Cette catégorie existe déjà." }, { status: 409 });
  const result = await prisma.medicament.updateMany({ where: { categorie: ancienCode }, data: { categorie: nouveauNom } });
  return NextResponse.json({ updated: result.count, categorie: nouveauNom });
}
