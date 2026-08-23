import BackButton from "@/app/components/BackButton";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { differenceInMonths } from "date-fns";
import {
  getCategorie, getCategorieLabel, getCategorieColor,
} from "@/lib/utils";
import PrintButton from "./PrintButton";
import {
  buildTroupeauWhere,
  filtrerAnimauxParCriteresLocaux,
  getActiveTroupeauFilters,
  normalizeTroupeauFilters,
} from "@/lib/troupeau-filters";

interface PageProps {
  searchParams: Promise<{
    sexe?: string; q?: string; categorie?: string;
    tarie?: string; repro?: string; sanitaire?: string; sevrage?: string;
    groupe?: string; tri?: string;
  }>;
}

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default async function TroupeauImpressionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const filters = normalizeTroupeauFilters(params);
  const where = buildTroupeauWhere(filters);
  const orderBy =
    filters.tri === "age_asc" ? { danais: "desc" as const }
    : filters.tri === "age_desc" ? { danais: "asc" as const }
    : { nutrav: "asc" as const };

  const animauxNonFiltres = await prisma.animal.findMany({
    where,
    orderBy,
    select: {
      id: true, nutrav: true, nobovi: true, nunati: true, danais: true,
      sexbov: true, estGenisse: true, categorie: true, race: true, sevreFait: true,
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
  const animaux = filtrerAnimauxParCriteresLocaux(animauxNonFiltres, filters, now);

  const printDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // Build filter summary
  const filterParts = getActiveTroupeauFilters(filters).map((filter) => filter.label);
  if (filters.q) filterParts.push(`Recherche : "${filters.q}"`);

  return (
    <div className="min-h-screen bg-white">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="print:hidden flex items-center justify-between px-4 py-3 bg-green-700 text-white">
        <BackButton label="Retour" className="inline-flex items-center gap-1.5 text-sm font-medium opacity-80 hover:opacity-100" />
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
