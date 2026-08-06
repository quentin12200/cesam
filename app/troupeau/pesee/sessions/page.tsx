import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Scale } from "lucide-react";
import {
  getWeighingSessionHistory,
  statusLabel,
  WEIGHING_SESSION_FILTERS,
} from "@/lib/weighing-session-history";
import { isWeighingSessionStatus, type WeighingSessionStatus } from "@/lib/weighing-sessions";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSessionDay(date: Date, now: Date = new Date()) {
  const daysAgo = Math.max(
    0,
    Math.round(
      (startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) / DAY_MS,
    ),
  );

  if (daysAgo === 0) return "Aujourd’hui";
  if (daysAgo === 1) return "Hier";
  if (daysAgo <= 6) return `Il y a ${daysAgo} jours`;
  return dateFormat.format(date);
}

export default async function WeighingSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = isWeighingSessionStatus(params.statut ?? null) ? params.statut as WeighingSessionStatus : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = await getWeighingSessionHistory({ page, limit: 12, status });
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const hrefFor = (nextPage: number, nextStatus = status) => {
    const query = new URLSearchParams();
    if (nextStatus) query.set("statut", nextStatus);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/troupeau/pesee/sessions${query.size ? `?${query}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-3 py-4 pb-24 text-gray-950">
      <div className="flex items-center gap-3 border-b-2 border-gray-900 pb-3">
        <Link href="/troupeau" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-300 bg-white" aria-label="Retour au troupeau">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Séances de pesée</h1>
          <p className="text-sm text-gray-600">{result.total} séance{result.total > 1 ? "s" : ""}</p>
        </div>
      </div>

      <nav aria-label="Filtrer les séances" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {WEIGHING_SESSION_FILTERS.map((filter) => {
          const active = filter.status === status;
          return (
            <Link key={filter.label} href={hrefFor(1, filter.status)} className={`flex min-h-11 shrink-0 items-center rounded-md border px-4 text-sm font-semibold ${active ? "border-black bg-black text-white" : "border-gray-300 bg-white text-gray-800"}`} aria-current={active ? "page" : undefined}>
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <div className="mt-6 border-y border-gray-300 py-8 text-center">
          <Scale className="mx-auto text-gray-500" />
          <p className="mt-2 font-semibold">Aucune séance dans ce filtre</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_1fr_auto] gap-3 border-b border-gray-300 px-3 pb-2 text-xs font-bold uppercase text-gray-600 md:grid">
            <span>Jour</span><span>Statut</span><span>Animaux</span><span>Sexes</span><span>Poids moyen</span><span>GMQ moyen</span><span>Action</span>
          </div>
          {result.items.map((session) => {
            const sessionDay = new Date(session.startedAt);
            return (
              <article key={session.id} className="rounded-md border border-gray-300 bg-white p-3 shadow-sm md:grid md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_1fr_auto] md:items-center md:gap-3">
                <div>
                  <p className="font-bold">{formatSessionDay(sessionDay)}</p>
                </div>
                <p className="mt-2 font-semibold md:mt-0">{statusLabel(session.status)}</p>
                <p className="mt-2 text-sm md:mt-0"><strong>{session.count}</strong> animaux</p>
                <p className="text-sm">{session.males} M · {session.females} F</p>
                <p className="mt-2 text-sm md:mt-0">{session.averageWeight === null ? "—" : `${session.averageWeight} kg`}</p>
                <div className="text-sm">
                  <p>{session.averageGmq === null ? "GMQ non disponible" : `${session.averageGmq.toFixed(1).replace(".", ",")} kg/j`}</p>
                  {session.hasSimulation && <p className="font-semibold text-green-800">Simulation enregistrée</p>}
                </div>
                <Link href={`/troupeau/pesee/sessions/${session.id}`} className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-black px-3 text-sm font-bold md:mt-0">
                  {session.status === "ACTIVE" ? "Ouvrir" : "Consulter"}
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          <Link aria-disabled={page <= 1} href={hrefFor(Math.max(1, page - 1))} className={`flex min-h-11 min-w-11 items-center justify-center rounded-md border ${page <= 1 ? "pointer-events-none text-gray-300" : "border-gray-400"}`}><ChevronLeft /></Link>
          <span className="text-sm font-semibold">Page {page} sur {pages}</span>
          <Link aria-disabled={page >= pages} href={hrefFor(Math.min(pages, page + 1))} className={`flex min-h-11 min-w-11 items-center justify-center rounded-md border ${page >= pages ? "pointer-events-none text-gray-300" : "border-gray-400"}`}><ChevronRight /></Link>
        </nav>
      )}
    </main>
  );
}
