import { prisma } from "@/lib/prisma";

export async function obtenirLotBouclesActif() {
  const actif = await prisma.lotBoucles.findFirst({
    where: { actif: true },
    orderBy: { createdAt: "asc" },
  });
  if (actif && actif.prochainIndex < actif.quantite) return actif;

  await prisma.lotBoucles.updateMany({ where: { actif: true }, data: { actif: false } });
  const lotsEnAttente = await prisma.lotBoucles.findMany({
    where: { actif: false },
    orderBy: { createdAt: "asc" },
  });
  const suivant = lotsEnAttente.find((lot) => lot.prochainIndex < lot.quantite);
  if (!suivant || suivant.prochainIndex >= suivant.quantite) return null;
  return prisma.lotBoucles.update({ where: { id: suivant.id }, data: { actif: true } });
}
