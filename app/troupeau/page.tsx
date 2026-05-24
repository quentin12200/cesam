import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getEtatGestation, getBadgeClass, formatAge } from "@/lib/utils";
import Link from "next/link";
import { Search, ChevronRight, ArrowLeft, Plus } from "lucide-react";
import { addDays } from "date-fns";
import NouvelAnimalForm from "./NouvelAnimalForm";

interface PageProps {
  searchParams: Promise<{
    sexe?: string;
    statut?: string;
    q?: string;
    page?: string;
    lot?: string;
    nouveau?: string;
  }>;
}

const PAGE_SIZE = 30;

async function getAnimaux(
  sexe?: string,
  statut?: string,
  q?: string,
  page = 1,
  lot?: string
) {
  const now = new Date();
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

  // Lot génisse filters (only when sexe=F or no sexe filter)
  if (lot === "vaches") {
    where.sexbov = "F";
    where.estGenisse = false;
  } else if (lot === "babies") {
    where.sexbov = "F";
    where.estGenisse = true;
    where.danais = { gte: addDays(now, -365) };
  } else if (lot === "moyennes") {
    where.sexbov = "F";
    where.estGenisse = true;
    where.danais = { gte: addDays(now, -730), lt: addDays(now, -365) };
  } else if (lot === "grandes") {
    where.sexbov = "F";
    where.estGenisse = true;
    where.danais = { gte: addDays(now, -1095), lt: addDays(now, -730) };
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
  const lot = params.lot;
  const showForm = params.nouveau === "1";

  const { animaux, total, pages } = await getAnimaux(sexe, statut, q, page, lot);

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

  const lotLabel: Record<string, string> = {
    vaches: "Vaches",
    babies: "Génisses <1 an",
    moyennes: "Génisses 1-2 ans",
    grandes: "Génisses 2-3 ans",
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800 flex-1">Troupeau</h2>
        {!showForm && (
          <Link
            href="/troupeau?nouveau=1"
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg shadow"
          >
            <Plus size={16} />
            Ajouter
          </Link>
        )}
      </div>

      {/* Formulaire nouvel animal */}
      {showForm && <NouvelAnimalForm />}

      {/* Recherche */}
      <form method="GET" action="/troupeau" className="relative">
        <input type="hidden" name="sexe" value={sexe ?? ""} />
        <input type="hidden" name="statut" value={statut ?? ""} />
        <input type="hidden" name="lot" value={lot ?? ""} />
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="N° Travail, N° Nat ou nom..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm shadow focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </form>

      {/* Filtres sexe / statut */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1 bg-white rounded-lg shadow p-1">
          <a
            href={buildUrl({ sexe: undefined, lot: undefined, page: "1" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!sexe && !lot ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Tous
          </a>
          <a
            href={buildUrl({ sexe: "F", lot: undefined, page: "1" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sexe === "F" && !lot ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Femelles
          </a>
          <a
            href={buildUrl({ sexe: "M", lot: undefined, page: "1" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sexe === "M" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Mâles
          </a>
        </div>
        <div className="flex gap-1 bg-white rounded-lg shadow p-1">
          <a
            href={buildUrl({ statut: undefined, page: "1" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statut ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Actifs
          </a>
          <a
            href={buildUrl({ statut: "SORTI", page: "1" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statut === "SORTI" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Sortis
          </a>
        </div>
      </div>

      {/* Filtres lots femelles */}
      <div className="flex gap-1 bg-white rounded-lg shadow p-1 flex-wrap">
        <a
          href={buildUrl({ lot: "vaches", sexe: undefined, page: "1" })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lot === "vaches" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Vaches
        </a>
        <a
          href={buildUrl({ lot: "babies", sexe: undefined, page: "1" })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lot === "babies" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Génisses &lt;1 an
        </a>
        <a
          href={buildUrl({ lot: "moyennes", sexe: undefined, page: "1" })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lot === "moyennes" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Génisses 1-2 ans
        </a>
        <a
          href={buildUrl({ lot: "grandes", sexe: undefined, page: "1" })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lot === "grandes" ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Génisses 2-3 ans
        </a>
      </div>

      <div className="text-xs text-gray-500">
        {lot ? `${lotLabel[lot]} · ` : ""}
        {total} animal{total > 1 ? "aux" : ""}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {animaux.map((animal) => (
          <Link
            key={animal.id}
            href={`/troupeau/${animal.nutrav}`}
            className="block bg-white rounded-xl shadow p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="bg-green-700 text-white font-bold px-3 py-2 rounded-lg font-mono text-lg min-w-[4.5rem] text-center">
                {animal.nutrav}
              </span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">
                  {animal.nobovi ?? <span className="text-gray-400 italic">Sans nom</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatAge(animal.danais)} ·{" "}
                  {animal.sexbov === "F"
                    ? animal.estGenisse
                      ? "Génisse"
                      : "Vache"
                    : "Mâle"}
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
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${getBadgeClass(etat)}`}
                      >
                        {etat === "VERT"
                          ? "Pleine"
                          : etat === "ROSE"
                          ? "Imminente"
                          : etat === "JAUNE"
                          ? "À écho"
                          : etat === "GRIS"
                          ? "En attente"
                          : "Vide"}
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
            <a
              href={buildUrl({ page: String(page - 1) })}
              className="px-4 py-2 bg-white rounded-lg shadow text-sm text-gray-700 hover:bg-gray-50"
            >
              Précédent
            </a>
          )}
          <span className="text-sm text-gray-500">
            Page {page} / {pages}
          </span>
          {page < pages && (
            <a
              href={buildUrl({ page: String(page + 1) })}
              className="px-4 py-2 bg-white rounded-lg shadow text-sm text-gray-700 hover:bg-gray-50"
            >
              Suivant
            </a>
          )}
        </div>
      )}
    </div>
  );
}
