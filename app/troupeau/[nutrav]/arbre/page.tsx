import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GitBranch } from "lucide-react";
import ArbreClient from "./ArbreClient";

import BackButton from "@/app/components/BackButton";
export interface TreeNode {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexe: string; // "M" | "F" | "T" (taureau) | "?"
  statut?: string;
  categorie?: string | null;
  danais?: string | null;
  isTaureau?: boolean;
}

export interface ArbreData {
  // Generation -2 (grands-parents maternels)
  grandMere: TreeNode | null;
  grandPere: TreeNode | null; // taureau du velage de la mère
  // Generation -1
  mere: TreeNode | null;
  pere: TreeNode | null; // taureau du velage de l'animal
  // Generation 0 (l'animal)
  animal: TreeNode;
  // Generation +1 (veaux)
  veaux: (TreeNode & { pereNom: string | null })[];
}

async function getArbreData(nutrav: string): Promise<ArbreData | null> {
  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      sexbov: true,
      statut: true,
      categorie: true,
      danais: true,
      mere: {
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          sexbov: true,
          statut: true,
          categorie: true,
          danais: true,
          mereId: true,
          mere: {
            select: { id: true, nutrav: true, nobovi: true, sexbov: true, statut: true, categorie: true, danais: true },
          },
          velageVeau: {
            select: { pereNom: true, pereNunati: true, gestation: { select: { saillie: { select: { taureau: { select: { id: true, nupere: true, nopere: true } } } } } } },
          },
        },
      },
      velageVeau: {
        select: {
          pereNom: true,
          pereNunati: true,
          gestation: {
            select: {
              saillie: {
                select: {
                  taureau: { select: { id: true, nupere: true, nopere: true } },
                },
              },
            },
          },
        },
      },
      veaux: {
        orderBy: { danais: "asc" },
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          sexbov: true,
          statut: true,
          categorie: true,
          danais: true,
          velageVeau: {
            select: {
              pereNom: true,
              pereNunati: true,
              gestation: { select: { saillie: { select: { taureau: { select: { nopere: true, nupere: true } } } } } },
            },
          },
        },
      },
    },
  });

  if (!animal) return null;

  function toNode(a: { id: string; nutrav: string; nobovi: string | null; sexbov: string; statut?: string; categorie?: string | null; danais?: Date | null }): TreeNode {
    return {
      id: a.id,
      nutrav: a.nutrav,
      nobovi: a.nobovi,
      sexe: a.sexbov,
      statut: a.statut,
      categorie: a.categorie,
      danais: a.danais?.toISOString() ?? null,
    };
  }

  function taureauToNode(t: { id: string; nupere: string; nopere: string | null } | null | undefined, fallbackNom: string | null, fallbackNunati: string | null): TreeNode | null {
    if (t) {
      return { id: t.id, nutrav: t.nupere, nobovi: t.nopere, sexe: "T", isTaureau: true };
    }
    const nom = fallbackNom ?? fallbackNunati;
    if (!nom) return null;
    return { id: `ext-${nom}`, nutrav: nom, nobovi: null, sexe: "T", isTaureau: true };
  }

  // Père de l'animal
  const pereAnimal = taureauToNode(
    animal.velageVeau?.gestation?.saillie?.taureau ?? null,
    animal.velageVeau?.pereNom ?? null,
    animal.velageVeau?.pereNunati ?? null
  );

  // Père de la mère (grand-père maternel)
  const grandPere = animal.mere
    ? taureauToNode(
        animal.mere.velageVeau?.gestation?.saillie?.taureau ?? null,
        animal.mere.velageVeau?.pereNom ?? null,
        animal.mere.velageVeau?.pereNunati ?? null
      )
    : null;

  const veaux = animal.veaux.map((v) => {
    const pereLabel =
      v.velageVeau?.gestation?.saillie?.taureau?.nopere ??
      v.velageVeau?.gestation?.saillie?.taureau?.nupere ??
      v.velageVeau?.pereNom ??
      v.velageVeau?.pereNunati ??
      null;
    return { ...toNode(v), pereNom: pereLabel };
  });

  return {
    grandMere: animal.mere?.mere ? toNode(animal.mere.mere) : null,
    grandPere,
    mere: animal.mere ? toNode(animal.mere) : null,
    pere: pereAnimal,
    animal: toNode(animal),
    veaux,
  };
}

export default async function ArbrePage({ params }: { params: Promise<{ nutrav: string }> }) {
  const { nutrav } = await params;
  const data = await getArbreData(nutrav);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/40 to-white">
      <div className="max-w-5xl mx-auto p-4 pb-24">
        <div className="flex items-center gap-3 mt-2 mb-6">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <GitBranch size={20} className="text-green-700" />
              Arbre généalogique
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.animal.nutrav}
              {data.animal.nobovi ? ` · ${data.animal.nobovi}` : ""}
            </p>
          </div>
        </div>

        <ArbreClient data={data} />
      </div>
    </div>
  );
}
