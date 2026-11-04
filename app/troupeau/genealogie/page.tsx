import { prisma } from "@/lib/prisma";
import { Network } from "lucide-react";
import GeneaClient from "./GeneaClient";
import { GENEA_DATA, type GeneaEntry } from "@/app/api/genealogie-import/data";

import BackButton from "@/app/components/BackButton";
export type { GeneaEntry };

export interface AnimalGeneaNode {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexe: string;
  statut: string;
  categorie: string | null;
  danais: string | null;
  mereId: string | null;
  pereNom: string | null;   // depuis velageVeau
  pereNat: string | null;   // N°National du père
  children: AnimalGeneaNode[];
}

async function getGeneaData(): Promise<AnimalGeneaNode[]> {
  const animaux = await prisma.animal.findMany({
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      sexbov: true,
      statut: true,
      categorie: true,
      danais: true,
      mereId: true,
      velageVeau: {
        select: {
          pereNom: true,
          pereNunati: true,
          gestation: {
            select: {
              saillie: {
                select: {
                  taureau: { select: { nopere: true, nupere: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { danais: "asc" },
  });

  const ids = new Set(animaux.map((a) => a.id));
  const map = new Map<string, AnimalGeneaNode>();

  for (const a of animaux) {
    const pereNom =
      a.velageVeau?.gestation?.saillie?.taureau?.nopere ??
      a.velageVeau?.gestation?.saillie?.taureau?.nupere ??
      a.velageVeau?.pereNom ??
      a.velageVeau?.pereNunati ??
      null;
    map.set(a.id, {
      id: a.id,
      nutrav: a.nutrav,
      nobovi: a.nobovi,
      sexe: a.sexbov,
      statut: a.statut,
      categorie: a.categorie,
      danais: a.danais?.toISOString() ?? null,
      mereId: a.mereId,
      pereNom,
      pereNat: a.velageVeau?.pereNunati ?? a.velageVeau?.gestation?.saillie?.taureau?.nupere ?? null,
      children: [],
    });
  }

  // Construire l'arbre
  const roots: AnimalGeneaNode[] = [];
  for (const node of map.values()) {
    if (node.mereId && ids.has(node.mereId)) {
      map.get(node.mereId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Trier les enfants par date de naissance
  function sortChildren(node: AnimalGeneaNode) {
    node.children.sort((a, b) => {
      if (!a.danais) return 1;
      if (!b.danais) return -1;
      return a.danais.localeCompare(b.danais);
    });
    node.children.forEach(sortChildren);
  }
  roots.sort((a, b) => {
    if (!a.danais) return 1;
    if (!b.danais) return -1;
    return a.danais.localeCompare(b.danais);
  });
  roots.forEach(sortChildren);

  return roots;
}

export default async function GenealogiePage() {
  const roots = await getGeneaData();
  const totalAnimaux = countAll(roots);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/30 to-white">
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <div className="flex items-center gap-3 mt-2 mb-6">
          <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Network size={20} className="text-emerald-700" />
              Généalogie globale
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalAnimaux} animaux · cliquer sur ► pour déplier / replier
            </p>
          </div>
        </div>

        <GeneaClient roots={roots} geneaData={GENEA_DATA} />
      </div>
    </div>
  );
}

function countAll(nodes: AnimalGeneaNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
}
