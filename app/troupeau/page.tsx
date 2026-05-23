import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getEtatGestation, getBadgeClass, formatAge } from "@/lib/utils";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ sexe?: string; statut?: string; q?: string; page?: string }>;
}

const PAGE_SIZE = 30;

async function getAnimaux(sexe?: string, statut?: string, q?: string, page = 1) {
  const where: Prisma.AnimalWhereInput = {};

  if (sexe && (sexe === "F" || sexe === "M")) where.sexbov = sexe;
  if (statut && (statut === "ACTIF" || statut === "SORTI")) where.statut = statut;
  else if (!statut) where.statut = "ACTIF";

  if (q && q.trim()) {
    where.OR = [
      { nutrav: { contains: q.trim() } },
      { nobovi: { contains: q.trim() } },
      { nunati: { contains: q.trim() } },
    ];
  }

  const [total, animaux] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      orderBy: { nutrav: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        nunati: true,
        danais: true,
        sexbov: true,
        statut: true,
        estGenisse: true,
        race: true,
        saillies: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: {
            date: true,
            gestation: { select: { etat: true, dateVelagePrevue: true } },
          },
        },
        velagesVache: {
          orderBy: { date: "desc" as const },
          take: 1,
          select: {
            date: true,
            veau: { select: { nutrav: true, statut: true } },
          },
        },
      },
    }),
  ]);

  return { animaux, total, pages: Math.ceil(total / PAGE_SIZE) };
}

export default async function TroupeauPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sexe = params.sexe;
  const statut = params.statut;
  const q = params.q;
  const page = parseInt(params.page ?? "1", 10);

  const { animaux, total, pages } = await getAnimaux(sexe, statut, q, page);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = {};
    if (sexe) p.sexe = sexe;
    if (statut) p.statut = statut;
    if (q) p.q = q;
    if (page > 1) p.page = String(page);
    Object.assign(p, overrides);
    Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
    const qs = new URLSearchParams(p as Record<string, string>).toString();
    return `/troupeau${qs ? "?" + qs : ""}`;
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mt-2">Troupeau</h2>

      {/* Recherche */}
      <form method="GET" action="/troupeau" className="relative">
        <input type="hidden" name="sexe" value={sexe ?? ""} />
        <input type="hidden" name="statut" value={statut ?? ""} />
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher par NUTRAV ou nom..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </form>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-white rounded-lg shadow p-1">
          <a href={buildUrl({ sexe: undefined, page: "1" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!sexe ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Tous</a>
          <a href={buildUrl({ sexe: "F", page: "1" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sexe === "F" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Femelles</a>
          <a href={buildUrl({ sexe: "M", page: "1" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sexe === "M" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Mâles</a>
        </div>
        <div className="flex gap-1 bg-white rounded-lg shadow p-1">
          <a href={buildUrl({ statut: undefined, page: "1" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statut ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Actifs</a>
          <a href={buildUrl({ statut: "SORTI", page: "1" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statut === "SORTI" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Sortis</a>
        </div>
      </div>

      <div className="text-xs text-gray-500">{total} animal{total > 1 ? "aux" : ""}</div>

      {/* Liste */}
      <div className="space-y-2">
        {animaux.map((animal) => (
          <Link
            key={animal.id}
            href={`/troupeau/${animal.nutrav}`}
            className="block bg-white rounded-xl shadow p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg font-mono text-base min-w-[4rem] text-center">
                {animal.nutrav}
              </span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">
                  {animal.nobovi ?? <span className="text-gray-400 italic">Sans nom</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatAge(animal.danais)} • {animal.sexbov === "F" ? (animal.estGenisse ? "Génisse" : "Vache") : "Mâle"}
                </div>
                {(() => {
                  if (animal.sexbov !== "F" || animal.estGenisse) return null;
                  const etat = getEtatGestation(
                    animal.saillies[0]?.date ?? null,
                    animal.saillies[0]?.gestation?.etat ?? null,
                    animal.saillies[0]?.gestation?.dateVelagePrevue ?? null,
                    animal.velagesVache[0]?.date ?? null
                  );
                  const veau = animal.velagesVache[0]?.veau;
                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(etat)}`}>
                        {etat === "VERT" ? "Pleine" : etat === "ROSE" ? "Imminente" : etat === "JAUNE" ? "À écho" : etat === "GRIS" ? "En attente" : "Vide"}
                      </span>
                      {veau && veau.statut === "ACTIF" && (
                        <span className="text-xs text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                          🐮 {veau.nutrav}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          </Link>
        ))}
        {animaux.length === 0 && (
          <div className="text-center text-gray-500 py-12 bg-white rounded-xl shadow">
            Aucun animal trouvé
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          {page > 1 && (
            <a href={buildUrl({ page: String(page - 1) })} className="px-4 py-2 bg-white rounded-lg shadow text-sm text-gray-700 hover:bg-gray-50">Précédent</a>
          )}
          <span className="text-sm text-gray-500">Page {page} / {pages}</span>
          {page < pages && (
            <a href={buildUrl({ page: String(page + 1) })} className="px-4 py-2 bg-white rounded-lg shadow text-sm text-gray-700 hover:bg-gray-50">Suivant</a>
          )}
        </div>
      )}
    </div>
  );
}
