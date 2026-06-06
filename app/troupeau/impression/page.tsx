export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { addDays, differenceInMonths, subDays } from "date-fns";
import {
  getCategorie, getCategorieLabel, getCategorieColor,
  type CategorieAnimal,
} from "@/lib/utils";
import Link from "next/link";
import PrintButton from "./PrintButton";

interface PageProps {
  searchParams: Promise<{
    sexe?: string; q?: string; categorie?: string;
    tarie?: string; repro?: string; sanitaire?: string;
    groupe?: string; tri?: string;
  }>;
}

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default async function TroupeauImpressionPage({ searchParams }: PageProps) {
  const { sexe, q, categorie, tarie, repro, sanitaire, groupe, tri } = await searchParams;
  const now = new Date();

  const where: Prisma.AnimalWhereInput = { statut: "ACTIF" };

  if (sexe === "F" || sexe === "M") where.sexbov = sexe;

  if (q?.trim()) {
    where.OR = [
      { nutrav: { contains: q.trim() } },
      { nobovi: { contains: q.trim() } },
      { nunati: { contains: q.trim() } },
    ];
  }

  if (tarie === "non") where.velagesVache = { some: { veau: { statut: "ACTIF", sevreFait: false } } };
  if (tarie === "oui") {
    where.sexbov = "F";
    where.velagesVache = { none: { veau: { statut: "ACTIF", sevreFait: false } } };
  }
  if (groupe) where.groupeId = groupe;

  if (repro === "PLEINE") { where.sexbov = "F"; where.saillies = { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } }; }
  else if (repro === "VIDE") { where.sexbov = "F"; where.NOT = { saillies: { some: { gestation: { etat: { in: ["VERT", "ROSE"] } } } } }; }
  else if (repro === "A_ECO") {
    where.sexbov = "F";
    where.saillies = {
      some: {
        date: { lte: subDays(now, 35) },
        gestation: { etat: { notIn: ["VERT", "ROUGE"] } },
      },
    };
  }

  if (sanitaire === "PROBLEME") where.evenements = { some: { resolu: false } };
  else if (sanitaire === "OK") where.evenements = { none: { resolu: false } };

  if (categorie && categorie !== "TOUS") {
    switch (categorie as CategorieAnimal) {
      case "VACHE":
        where.sexbov = "F"; where.estGenisse = false;
        where.danais = { lt: addDays(now, -365) }; where.categorie = null; break;
      case "PETITE_GENISSE":
        where.sexbov = "F"; where.estGenisse = true;
        where.danais = { gte: addDays(now, -365) }; break;
      case "MOYENNE_GENISSE":
        where.sexbov = "F"; where.estGenisse = true;
        where.danais = { gte: addDays(now, -730), lt: addDays(now, -365) }; break;
      case "GRANDE_GENISSE":
        where.sexbov = "F"; where.estGenisse = true;
        where.danais = { gte: addDays(now, -1095), lt: addDays(now, -730) }; break;
      case "TAUREAU":
        where.sexbov = "M"; where.danais = { lt: addDays(now, -456) }; break;
      case "VEAU_M":
        where.sexbov = "M"; where.danais = { gte: addDays(now, -456) }; break;
      default:
        where.categorie = categorie;
    }
  }

  const orderBy: Prisma.AnimalOrderByWithRelationInput =
    tri === "age_asc" ? { danais: "desc" }
    : tri === "age_desc" ? { danais: "asc" }
    : { nutrav: "asc" };

  const animaux = await prisma.animal.findMany({
    where,
    orderBy,
    select: {
      id: true, nutrav: true, nobovi: true, nunati: true, danais: true,
      sexbov: true, estGenisse: true, categorie: true, race: true,
      groupe: { select: { nom: true } },
      saillies: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          date: true,
          gestation: { select: { etat: true, dateVelagePrevue: true } },
          taureau: { select: { nopere: true, nupere: true } },
        },
      },
      velagesVache: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Build filter summary
  const filterParts: string[] = [];
  if (sexe === "F") filterParts.push("Femelles");
  else if (sexe === "M") filterParts.push("Mâles");
  if (categorie && categorie !== "TOUS") filterParts.push(categorie.replace(/_/g, " ").toLowerCase());
  if (tarie === "non") filterParts.push("Non taries");
  if (tarie === "oui") filterParts.push("Taries");
  if (repro === "PLEINE") filterParts.push("Pleines");
  if (repro === "VIDE") filterParts.push("Vides");
  if (repro === "A_ECO") filterParts.push("À échographier");
  if (q) filterParts.push(`Recherche : "${q}"`);

  return (
    <div className="min-h-screen bg-white">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-green-700 text-white">
        <Link href="/troupeau" className="text-sm font-medium opacity-80 hover:opacity-100">← Retour</Link>
        <span className="font-bold">Impression troupeau</span>
        <PrintButton />
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">GAEC CESAM — Troupeau</h1>
          <p className="text-sm text-gray-500 mt-1">
            Imprimé le {printDate} · {animaux.length} {animaux.length > 1 ? "animaux" : "animal"}
            {filterParts.length > 0 && ` · Filtres : ${filterParts.join(", ")}`}
          </p>
        </div>

        {/* Tableau */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <th className="text-left px-2 py-2 border border-gray-200">N° Trav.</th>
              <th className="text-left px-2 py-2 border border-gray-200">Nom</th>
              <th className="text-left px-2 py-2 border border-gray-200">Catégorie</th>
              <th className="text-center px-2 py-2 border border-gray-200">Âge</th>
              <th className="text-left px-2 py-2 border border-gray-200">Groupe</th>
              <th className="text-center px-2 py-2 border border-gray-200">Dernière saillie</th>
              <th className="text-center px-2 py-2 border border-gray-200">Terme prévu</th>
            </tr>
          </thead>
          <tbody>
            {animaux.map((a, i) => {
              const cat = getCategorie(a.sexbov, a.danais, a.estGenisse, a.categorie);
              const catLabel = getCategorieLabel(a.sexbov, a.danais, a.estGenisse, a.categorie);
              const ageMois = differenceInMonths(now, a.danais);
              const ageStr = ageMois < 12 ? `${ageMois} m` : `${Math.floor(ageMois / 12)} a ${ageMois % 12} m`;
              const saillie = a.saillies[0];
              const dateVelage = saillie?.gestation?.dateVelagePrevue;
              const rowBg = i % 2 === 0 ? "bg-white" : "bg-gray-50";
              return (
                <tr key={a.id} className={rowBg}>
                  <td className="px-2 py-1.5 border border-gray-200 font-mono font-bold text-green-700">{a.nutrav}</td>
                  <td className="px-2 py-1.5 border border-gray-200 font-medium">{a.nobovi ?? <span className="text-gray-400 italic">Sans nom</span>}</td>
                  <td className="px-2 py-1.5 border border-gray-200">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getCategorieColor(cat)}`}>{catLabel}</span>
                  </td>
                  <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-600">{ageStr}</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-gray-600 text-xs">{a.groupe?.nom ?? "—"}</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-700">{fmt(saillie?.date)}</td>
                  <td className={`px-2 py-1.5 border border-gray-200 text-center font-medium ${dateVelage ? "text-green-700" : "text-gray-300"}`}>
                    {fmt(dateVelage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {animaux.length === 0 && (
          <p className="text-center text-gray-400 py-12">Aucun animal pour ces filtres</p>
        )}
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 landscape; }
          body { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}
