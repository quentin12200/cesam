import type { Prisma } from "@prisma/client";
import BackButton from "@/app/components/BackButton";
import PrintButton from "@/app/troupeau/impression/PrintButton";
import { prisma } from "@/lib/prisma";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { getWeaningDryOffCandidates } from "@/lib/weaning-dry-off-data";
import { buildWeaningPrintGroups, type WeaningPrintRow } from "@/lib/weaning-print";
import { formatAge, getEtatGestation, type EtatGestation } from "@/lib/utils";

export const dynamic = "force-dynamic";

const motherSelect = {
  id: true,
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
  const countLabel = `${rows.length} ${rows.length === 1 ? "veau" : "veaux"}`;
  return (
    <section className="work-section">
      <h2>{title} — {countLabel}</h2>
      <table>
        <thead>
          <tr>
            <th className="check-column">☐</th>
            <th>Veau</th>
            <th>Sexe</th>
            <th>Âge</th>
            <th>Mère</th>
            <th>État mère</th>
            <th>À faire en même temps</th>
            <th>Autre / Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="paper-check">☐</td>
              <td className="animal-number">{row.nutrav}</td>
              <td className="sex-column">{row.sexLabel}</td>
              <td>{formatAge(row.birthDate)}</td>
              <td className="animal-number mother-number">{row.motherNutrav ?? "—"}</td>
              <td>{row.motherStatus}</td>
              <td>{row.simultaneousTask}</td>
              <td aria-label="Autre ou notes">&nbsp;</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="empty-row">
              <td colSpan={8}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function WeaningPrintPage() {
  const now = new Date();
  const operational = await getWeaningDryOffCandidates(now);
  const operationalCandidates = operational.candidates.filter((candidate) => candidate.needsWeaning);
  const calfIds = operationalCandidates.map((candidate) => candidate.calf.id);
  const motherIds = [...new Set(operationalCandidates.map((candidate) => candidate.mother.id))];
  const [calfDetails, mothers, reproductionConfig] = await Promise.all([
    prisma.animal.findMany({
      where: { id: { in: calfIds } },
      select: { id: true, sexbov: true },
    }),
    prisma.animal.findMany({
      where: { id: { in: motherIds } },
      select: motherSelect,
    }),
    prisma.exploitationConfig.findUnique({
      where: { id: "singleton" },
      select: { reproReposObjectifJours: true },
    }).catch(() => null),
  ]);

  const calvesById = new Map(calfDetails.map((calf) => [calf.id, calf]));
  const mothersById = new Map(mothers.map((mother) => [mother.id, mother]));
  const candidates = operationalCandidates.map((candidate) => {
    const mother = mothersById.get(candidate.mother.id);
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
      id: candidate.calf.id,
      nutrav: candidate.calf.nutrav,
      birthDate: new Date(candidate.calf.birthDate),
      window: candidate.window,
      needsWeaning: candidate.needsWeaning,
      sex: calvesById.get(candidate.calf.id)?.sexbov ?? null,
      motherNutrav: candidate.mother.nutrav ?? null,
      motherStatus: calculatedStatus ?? "Inconnu",
      motherHasActiveEchoRequest: Boolean(mother?.demandesEchographie.length),
    };
  });
  const groups = buildWeaningPrintGroups(candidates);

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
      </div>

      <style>{`
        .print-sheet { min-height: 100vh; background: white; color: #111; }
        .screen-actions { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #166534; color: white; }
        .sheet-content { max-width: 1120px; margin: 0 auto; padding: 20px 28px 28px; }
        header { border-bottom: 2px solid #111; padding-bottom: 9px; }
        h1 { margin: 0; text-align: center; font-size: 24px; letter-spacing: .04em; }
        .planning-lines { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; margin-top: 12px; font-size: 14px; font-weight: 600; }
        .planning-lines p { margin: 0; }
        .work-section { margin-top: 14px; break-inside: auto; }
        h2 { margin: 0 0 5px; font-size: 15px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: middle; }
        th { background: #eee; font-size: 9px; text-transform: uppercase; letter-spacing: .02em; }
        th:nth-child(1) { width: 4%; }
        th:nth-child(2) { width: 13%; }
        th:nth-child(3) { width: 5%; }
        th:nth-child(4) { width: 9%; }
        th:nth-child(5) { width: 13%; }
        th:nth-child(6) { width: 14%; }
        th:nth-child(7) { width: 20%; }
        th:nth-child(8) { width: 22%; }
        .check-column, .paper-check, .sex-column { text-align: center; }
        .paper-check { font-size: 19px; line-height: 1; }
        .animal-number { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; font-weight: 800; letter-spacing: .02em; }
        .mother-number { font-size: 14px; }
        .empty-row td { height: 36px; text-align: center; font-style: italic; color: #555; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white !important; color: black !important; }
          .screen-actions { display: none !important; }
          .sheet-content { max-width: none; margin: 0; padding: 0; }
          .work-section { margin-top: 11px; }
          table { font-size: 10px; }
          th, td { border-color: #000; padding: 4px 5px; }
          th { background: #eee !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </main>
  );
}
