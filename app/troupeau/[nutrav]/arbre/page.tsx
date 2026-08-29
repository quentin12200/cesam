import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GitBranch } from "lucide-react";
import ArbreClient from "./ArbreClient";
import { findAnimalsByExactNational, normalizeGenealogyNational } from "@/lib/animal-genealogy-data";
import { resolveAncestryIdentity } from "@/lib/animal-genealogy";

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
  nationalNumber?: string | null;
  linkNutrav?: string | null;
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
      nunati: true,
      numeroNational: true,
      numeip: true,
      nomeip: true,
      mereTravailManuel: true,
      mereNationalManuel: true,
      mereNomManuel: true,
      pereTravailManuel: true,
      pereNationalManuel: true,
      pereNomManuel: true,
      taureau: { select: { id: true, nupere: true, nopere: true } },
      mere: {
        select: {
          id: true,
          nutrav: true,
          nobovi: true,
          sexbov: true,
          statut: true,
          categorie: true,
          danais: true,
          nunati: true,
          numeroNational: true,
          numeip: true,
          nomeip: true,
          mereTravailManuel: true,
          mereNationalManuel: true,
          mereNomManuel: true,
          pereTravailManuel: true,
          pereNationalManuel: true,
          pereNomManuel: true,
          taureau: { select: { id: true, nupere: true, nopere: true } },
          mereId: true,
          mere: {
            select: { id: true, nutrav: true, nunati: true, numeroNational: true, nobovi: true, sexbov: true, statut: true, categorie: true, danais: true },
          },
          velageVeau: {
            select: { pereNom: true, pereNunati: true, vache: { select: { id: true, nutrav: true, nunati: true, numeroNational: true, nobovi: true, sexbov: true, statut: true, categorie: true, danais: true } }, gestation: { select: { saillie: { select: { taureau: { select: { id: true, nupere: true, nopere: true } } } } } } },
          },
        },
      },
      velageVeau: {
        select: {
          pereNom: true,
          pereNunati: true,
          vache: { select: { id: true, nutrav: true, nunati: true, numeroNational: true, nobovi: true, sexbov: true, statut: true, categorie: true, danais: true } },
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
      veauxVelage: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          velage: {
            select: {
              pereNom: true,
              pereNunati: true,
              vache: { select: { id: true, nutrav: true, nunati: true, numeroNational: true, nobovi: true, sexbov: true, statut: true, categorie: true, danais: true } },
              gestation: { select: { saillie: { select: { taureau: { select: { id: true, nupere: true, nopere: true } } } } } },
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

  const birthVelage = animal.velageVeau ?? animal.veauxVelage[0]?.velage ?? null;
  const ancestryAnimals = await findAnimalsByExactNational([
    animal.numeip,
    animal.mereNationalManuel,
    animal.taureau?.nupere,
    birthVelage?.pereNunati,
    animal.pereNationalManuel,
    animal.mere?.numeip,
    animal.mere?.mereNationalManuel,
    animal.mere?.taureau?.nupere,
    animal.mere?.velageVeau?.pereNunati,
    animal.mere?.pereNationalManuel,
  ]);

  function toNode(a: { id: string; nutrav: string; nunati?: string; numeroNational?: string | null; nobovi: string | null; sexbov: string; statut?: string; categorie?: string | null; danais?: Date | null }): TreeNode {
    return {
      id: a.id,
      nutrav: a.nutrav,
      nationalNumber: a.numeroNational ?? a.nunati ?? null,
      nobovi: a.nobovi,
      sexe: a.sexbov,
      statut: a.statut,
      categorie: a.categorie,
      danais: a.danais?.toISOString() ?? null,
      linkNutrav: a.nutrav,
    };
  }

  function identityToNode(identity: ReturnType<typeof resolveAncestryIdentity>, sex: "F" | "T"): TreeNode | null {
    if (!identity) return null;
    const matched = ancestryAnimals.get(normalizeGenealogyNational(identity.nationalNumber));
    if (matched) {
      return toNode({
        id: matched.id,
        nutrav: matched.nutrav,
        nunati: matched.nationalNumber,
        numeroNational: matched.nationalNumber,
        nobovi: matched.name,
        sexbov: matched.sex,
        statut: matched.status,
        categorie: matched.category,
        danais: matched.birthDate,
      });
    }
    return {
      id: `ext-${sex}-${identity.workNumber ?? identity.nationalNumber ?? identity.name}`,
      nutrav: identity.workNumber ?? identity.nationalNumber ?? "—",
      nationalNumber: identity.nationalNumber,
      nobovi: identity.name,
      sexe: sex,
      isTaureau: sex === "T",
      linkNutrav: null,
    };
  }

  const motherRecord = animal.mere ?? birthVelage?.vache ?? null;
  const motherIdentity = resolveAncestryIdentity([
    motherRecord
      ? null
      : {
          workNumber: animal.mereTravailManuel,
          nationalNumber: animal.numeip ?? animal.mereNationalManuel,
          name: animal.nomeip ?? animal.mereNomManuel,
          linkedAnimalNutrav: null,
        },
  ]);
  const motherNode = motherRecord ? toNode(motherRecord) : identityToNode(motherIdentity, "F");

  const linkedFather = animal.taureau ?? birthVelage?.gestation?.saillie?.taureau ?? null;
  const fatherIdentity = resolveAncestryIdentity([
    linkedFather
      ? {
          workNumber: animal.pereTravailManuel,
          nationalNumber: linkedFather.nupere,
          name: linkedFather.nopere,
          linkedAnimalNutrav: null,
        }
      : null,
    birthVelage
      ? {
          workNumber: animal.pereTravailManuel,
          nationalNumber: birthVelage.pereNunati ?? animal.pereNationalManuel,
          name: birthVelage.pereNom ?? animal.pereNomManuel,
          linkedAnimalNutrav: null,
        }
      : null,
    {
      workNumber: animal.pereTravailManuel,
      nationalNumber: animal.pereNationalManuel,
      name: animal.pereNomManuel,
      linkedAnimalNutrav: null,
    },
  ]);
  const pereAnimal = identityToNode(fatherIdentity, "T");

  const grandMotherIdentity = animal.mere
    ? resolveAncestryIdentity([{
        workNumber: animal.mere.mereTravailManuel,
        nationalNumber: animal.mere.numeip ?? animal.mere.mereNationalManuel,
        name: animal.mere.nomeip ?? animal.mere.mereNomManuel,
        linkedAnimalNutrav: null,
      }])
    : null;
  const grandMere = animal.mere?.mere
    ? toNode(animal.mere.mere)
    : identityToNode(grandMotherIdentity, "F");
  const motherFather = animal.mere?.taureau
    ?? animal.mere?.velageVeau?.gestation?.saillie?.taureau
    ?? null;
  const grandFatherIdentity = animal.mere
    ? resolveAncestryIdentity([
        motherFather
          ? {
              workNumber: animal.mere.pereTravailManuel,
              nationalNumber: motherFather.nupere,
              name: motherFather.nopere,
              linkedAnimalNutrav: null,
            }
          : null,
        {
          workNumber: animal.mere.pereTravailManuel,
          nationalNumber: animal.mere.velageVeau?.pereNunati ?? animal.mere.pereNationalManuel,
          name: animal.mere.velageVeau?.pereNom ?? animal.mere.pereNomManuel,
          linkedAnimalNutrav: null,
        },
      ])
    : null;
  const grandPere = identityToNode(grandFatherIdentity, "T");

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
    grandMere,
    grandPere,
    mere: motherNode,
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
