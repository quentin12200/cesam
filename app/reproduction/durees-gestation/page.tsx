import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { classifyGestation, summarizeGestations } from "@/lib/gestation-duration-report";

export const dynamic = "force-dynamic";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(date);
}
function displayMean(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1).replace(".", ",")} j`;
}

export default async function GestationDurationsPage() {
  // Lecture seule : aucun update, création ou synchronisation automatique.
  const calvings = await prisma.velage.findMany({
    select: {
      id: true, date: true, qualificatif: true, vacheId: true,
      vache: { select: { nutrav: true, nobovi: true } },
      gestation: {
        select: {
          saillie: { select: { date: true, estimation: true, animalId: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const motherIds = [...new Set(calvings.map((v) => v.vacheId))];
  const breedings = await prisma.saillie.findMany({
    where: { animalId: { in: motherIds } },
    select: { id: true, animalId: true, date: true },
    orderBy: { date: "asc" },
  });
  const calvingsByMother = new Map<string, Date[]>();
  for (const calving of calvings) {
    const dates = calvingsByMother.get(calving.vacheId) ?? [];
    dates.push(calving.date);
    calvingsByMother.set(calving.vacheId, dates);
  }
  const breedingsByMother = new Map<string, typeof breedings>();
  for (const breeding of breedings) {
    const entries = breedingsByMother.get(breeding.animalId) ?? [];
    entries.push(breeding);
    breedingsByMother.set(breeding.animalId, entries);
  }
  const rows = calvings.map((calving) => {
    const linked = calving.gestation?.saillie;
    const earlier = (calvingsByMother.get(calving.vacheId) ?? []).filter((date) => date < calving.date);
    const previousCalving = earlier.length ? earlier.reduce((latest, date) => date > latest ? date : latest) : null;
    const competing = (breedingsByMother.get(calving.vacheId) ?? []).filter((breeding) =>
      breeding.date < calving.date &&
      (!previousCalving || breeding.date > previousCalving) &&
      (!linked || breeding.date.getTime() !== linked.date.getTime())
    );
    return {
      ...classifyGestation({
        id: calving.id,
        motherId: calving.vacheId,
        calvingDate: calving.date,
        breedingDate: linked?.date ?? null,
        linkedMotherId: linked?.animalId ?? null,
        estimatedBreeding: linked?.estimation ?? false,
        qualification: calving.qualificatif,
        previousCalvings: earlier.length,
        conflictingBreedings: competing.length,
      }),
      motherNumber: calving.vache.nutrav,
      motherName: calving.vache.nobovi,
    };
  });
  const summary = summarizeGestations(rows);
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 pb-20">
      <Link href="/reproduction" className="text-sm font-semibold text-green-700">← Reproduction</Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Durées réelles de gestation</h1>
        <p className="text-sm text-gray-600">Rapport en lecture seule · une ligne par vêlage · dates réelles de saillie et de vêlage</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Moyenne fiable", displayMean(summary.mean)],
          ["Gestations retenues", String(summary.included)],
          ["Minimum", summary.min === null ? "—" : `${summary.min} j`],
          ["Maximum", summary.max === null ? "—" : `${summary.max} j`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold">{value}</p></div>)}
      </div>
      <div className="rounded-xl border bg-white p-3 text-sm">
        <p><strong>{summary.total}</strong> vêlages examinés · <strong>{summary.excluded}</strong> exclus de la moyenne</p>
        <p>Primipares : <strong>{displayMean(summary.primipares.mean)}</strong> ({summary.primipares.count}) · Multipares : <strong>{displayMean(summary.multipares.mean)}</strong> ({summary.multipares.count})</p>
        <p className="mt-2 text-xs text-gray-500">Contrôle conservateur : exclusion des saillies estimées, liens absents ou incohérents, autres tentatives dans le cycle, avortements et durées hors 250–320 jours. Les exclusions restent visibles pour vérification.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-green-800 text-white"><tr>{["Mère", "Vêlage", "Saillie / IA", "Catégorie", "Durée", "Décision"].map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t">
            <td className="p-3"><Link href={`/troupeau/${row.motherNumber}`} className="font-bold text-green-800">{row.motherNumber}</Link> {row.motherName ?? ""}</td>
            <td className="p-3">{displayDate(row.calvingDate)}</td>
            <td className="p-3">{row.breedingDate ? displayDate(row.breedingDate) : "—"}</td>
            <td className="p-3">{row.category === "PRIMIPARE" ? "1er vêlage" : "Vache"}</td>
            <td className="p-3">{row.durationDays === null ? "—" : `${row.durationDays} j`}</td>
            <td className="p-3">{row.exclusion ?? "Retenue"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
