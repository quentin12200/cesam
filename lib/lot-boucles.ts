import { prisma } from "@/lib/prisma";
import type { NumeroIdentificationUtilise } from "@/lib/identification";

export async function obtenirNumerosIdentificationUtilises(): Promise<
  NumeroIdentificationUtilise[]
> {
  const [animaux, veaux] = await Promise.all([
    prisma.animal.findMany({
      select: {
        nutrav: true,
        nobovi: true,
        nunati: true,
        numeroNational: true,
      },
    }),
    prisma.veauVelage.findMany({
      select: {
        nutrav: true,
        nunati: true,
        nom: true,
        animal: { select: { nutrav: true, nobovi: true } },
      },
    }),
  ]);

  return [
    ...animaux.flatMap((animal) => {
      const utilisePar = `${animal.nutrav}${animal.nobovi ? ` — ${animal.nobovi}` : ""}`;
      const nationaux = [animal.numeroNational, animal.nunati].filter(
        (numero, index, tous): numero is string =>
          Boolean(numero) && tous.indexOf(numero) === index
      );
      return nationaux.map((nunati) => ({
        nutrav: animal.nutrav,
        nunati,
        utilisePar,
      }));
    }),
    ...veaux.map((veau) => ({
      nutrav: veau.nutrav,
      nunati: veau.nunati,
      utilisePar: veau.animal
        ? `${veau.animal.nutrav}${veau.animal.nobovi ? ` — ${veau.animal.nobovi}` : ""}`
        : veau.nutrav
          ? `${veau.nutrav}${veau.nom ? ` — ${veau.nom}` : ""}`
          : veau.nom ?? "Veau enregistré au vêlage",
    })),
  ];
}

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
