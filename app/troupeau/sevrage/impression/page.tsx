import type { Prisma } from "@prisma/client";
import { startOfDay, subMonths } from "date-fns";
import BackButton from "@/app/components/BackButton";
import PrintButton from "@/app/troupeau/impression/PrintButton";
import { prisma } from "@/lib/prisma";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { resolveCalfMother } from "@/lib/weaning-dry-off";
import { buildWeaningPrintGroups, type WeaningPrintRow } from "@/lib/weaning-print";
import { formatAge, getEtatGestation, type EtatGestation } from "@/lib/utils";

export const dynamic = "force-dynamic";

const motherSelect = {
  nutrav: true,
  reproductionEtatManuel: true,
  demandesEchographie: {
    where: { etat: "A_FAIRE" },
    take: 1,
    select: { id: true },
  },
  saillies: {
    orderBy: [{ date: "desc" as const }, { createdAt: "desc" as const }],
    select: {
      id: true,
      date: true,
      gestation: { select: { etat: true, dateVelagePrevue: true } },
    },
  },
  velagesVache: {
    orderBy: [{ date: "desc" as const }, { createdAt: "desc" as const }],
    take: 1,
    select: { date: true },
  },
} satisfies Prisma.AnimalSelect;

const REPRODUCTION_LABELS: Record<EtatGestation, string> = {
  VERT: "Gestante",
  ROSE: "Imminente",
  JAUNE: "À écho",
  GRIS: "En attente",
  ROUGE: "Vide",
  REPOS: "Repos",
};

function WorkTable({ title, rows, emptyMessage }: { title: string; rows: WeaningPrintRow[]; emptyMessage: string }) {
  return (
    <section className="work-section">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th className="check-column">☐</th>
            <th>Veau</th>
            <th>Âge</th>
            <th>Mère</th>
            <th>État mère</th>
            <th>À faire en même temps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="paper-check">☐</td>
              <td className="animal-number">{row.nutrav}</td>
              <td>{formatAge(row.birthDate)}</td>
              <td className="animal-number mother-number">{row.motherNutrav ?? "—"}</td>
              <td>{row.motherStatus}</td>
              <td>{row.simultaneousTask}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="empty-row">
              <td colSpan={6}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function WeaningPrintPage() {
  const now = new Date();
  const today = startOfDay(now);
  const [calves, reproductionConfig] = await Promise.all([
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        sevreFait: false,
        danais: {
          gte: subMonths(today, 12),
          lte: subMonths(today, 5),
        },
      },
      select: {
        id: true,
        nutrav: true,
        danais: true,
        statut: true,
        sevreFait: true,
        velageVeau: { select: { vache: { select: motherSelect } } },
        veauxVelage: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { velage: { select: { vache: { select: motherSelect } } } },
        },
        mere: { select: motherSelect },
      },
      orderBy: [{ danais: "asc" }, { nutrav: "asc" }],
    }),
    prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { reproReposObjectifJours: true },
    }).catch(() => null),
  ]);

  const candidates = calves.map((calf) => {
    const mother = resolveCalfMother(calf);
    const lastCalving = mother?.velagesVache[0]?.date ?? null;
    const currentBreeding = mother
      ? getCurrentCycleBreeding(mother.saillies, lastCalving)
      : null;
    const calculatedStatus = mother
      ? REPRODUCTION_LABELS[
          (mother.reproductionEtatManuel as EtatGestation | null)
          ?? getEtatGestation(
            currentBreeding?.date ?? null,
            currentBreeding?.gestation?.etat ?? null,
            currentBreeding?.gestation?.dateVelagePrevue ?? null,
            lastCalving,
            false,
            reproductionConfig?.reproReposObjectifJours ?? 60,
          )
        ] ?? "Inconnu"
      : null;
    return {
      id: calf.id,
      nutrav: calf.nutrav,
      birthDate: calf.danais,
      statut: calf.statut,
      sevreFait: calf.sevreFait,
      motherNutrav: mother?.nutrav ?? null,
      motherStatus: calculatedStatus ?? "Inconnu",
      motherHasActiveEchoRequest: Boolean(mother?.demandesEchographie.length),
    };
  });
  const groups = buildWeaningPrintGroups(candidates, now);

  return (
    <main className="print-sheet">
      <div className="screen-actions print:hidden">
        <BackButton label="Retour" />
        <strong>Impression sevrage</strong>
        <PrintButton />
      </div>

      <div className="sheet-content">
        <header>
          <h1>VEAUX À SEVRER</h1>
          <div className="planning-lines">
            <p>Date prévue : ____ / ____ / ______</p>
            <p>Lot / lieu : ______________________________________</p>
          </div>
        </header>

        <WorkTable title="1 — À SEVRER" rows={groups.ready} emptyMessage="Aucun veau à sevrer actuellement." />
        <WorkTable title="2 — À PRÉVOIR" rows={groups.upcoming} emptyMessage="Aucun veau à prévoir dans le mois à venir." />

        <section className="notes">
          <h2>Notes :</h2>
          <p>________________________________________________________</p>
          <p>________________________________________________________</p>
          <p>________________________________________________________</p>
        </section>
      </div>

      <style>{`
        .print-sheet { min-height: 100vh; background: white; color: #111; }
        .screen-actions { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #166534; color: white; }
        .sheet-content { max-width: 1120px; margin: 0 auto; padding: 24px 32px 40px; }
        header { border-bottom: 2px solid #111; padding-bottom: 12px; }
        h1 { margin: 0; text-align: center; font-size: 26px; letter-spacing: .04em; }
        .planning-lines { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; margin-top: 18px; font-size: 15px; font-weight: 600; }
        .planning-lines p { margin: 0; }
        .work-section { margin-top: 22px; break-inside: auto; }
        h2 { margin: 0 0 7px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 13px; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        th, td { border: 1px solid #333; padding: 8px 9px; text-align: left; vertical-align: middle; }
        th { background: #eee; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
        th:nth-child(1) { width: 5%; }
        th:nth-child(2) { width: 15%; }
        th:nth-child(3) { width: 11%; }
        th:nth-child(4) { width: 15%; }
        th:nth-child(5) { width: 17%; }
        th:nth-child(6) { width: 37%; }
        .check-column, .paper-check { text-align: center; }
        .paper-check { font-size: 22px; line-height: 1; }
        .animal-number { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; font-weight: 800; letter-spacing: .02em; }
        .mother-number { font-size: 15px; }
        .empty-row td { height: 48px; text-align: center; font-style: italic; color: #555; }
        .notes { margin-top: 24px; break-inside: avoid; }
        .notes p { margin: 9px 0 0; font-family: monospace; font-size: 15px; white-space: nowrap; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white !important; color: black !important; }
          .screen-actions { display: none !important; }
          .sheet-content { max-width: none; margin: 0; padding: 0; }
          .work-section { margin-top: 16px; }
          table { font-size: 11px; }
          th, td { border-color: #000; padding: 6px 7px; }
          th { background: #eee !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </main>
  );
}
