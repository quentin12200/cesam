export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BackButton from "@/app/components/BackButton";

function normalized(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").replace(/^FR/i, "").toUpperCase();
}

export default async function TaureauDescendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bull = await prisma.taureau.findUnique({
    where: { id },
    select: { id: true, nupere: true, nopere: true },
  });
  if (!bull) notFound();

  const animals = await prisma.animal.findMany({
    orderBy: { danais: "desc" },
    select: {
      id: true, nutrav: true, nobovi: true, statut: true,
      taureauId: true, pereNationalManuel: true,
      velageVeau: {
        select: {
          pereNunati: true,
          gestation: {
            select: { saillie: { select: { taureauId: true } } },
          },
        },
      },
    },
  });

  const national = normalized(bull.nupere);
  const hasCompleteNational = /^[0-9]{8,15}$/.test(national);
  const offspring = animals.filter((a) =>
    a.taureauId === bull.id ||
    a.velageVeau?.gestation?.saillie?.taureauId === bull.id ||
    (hasCompleteNational && [a.pereNationalManuel, a.velageVeau?.pereNunati]
      .some((n) => normalized(n) === national))
  );
  const present = offspring.filter((a) => a.statut === "ACTIF");
  const absent = offspring.filter((a) => a.statut !== "ACTIF");

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <BackButton className="rounded-lg bg-white p-2 shadow" iconSize={18} />
        <div>
          <h1 className="text-xl font-bold">Descendance · {bull.nopere ?? bull.nupere}</h1>
          <p className="text-xs text-gray-500">{bull.nupere}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600">{offspring.length} descendants directs · {present.length} présents · {absent.length} sortis</p>
      {([
        { title: "Présents", rows: present, style: "border-green-200 bg-green-50 text-green-800" },
        { title: "Sortis du troupeau", rows: absent, style: "border-gray-200 bg-gray-50 text-gray-700" },
      ]).map((group) => (
        <section key={group.title} className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold">{group.title} ({group.rows.length})</h2>
          {group.rows.length === 0 && <p className="text-sm text-gray-400">Aucun descendant.</p>}
          <div className="flex flex-wrap gap-2">
            {group.rows.map((a) => (
              <Link key={a.id} href={`/troupeau/${a.nutrav}`}
                className={`rounded-lg border px-2.5 py-2 text-sm ${group.style}`}>
                <span className="font-mono font-bold">{a.nutrav}</span>
                {a.nobovi && <span> · {a.nobovi}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-gray-500">
        Seuls les descendants identifiés avec certitude sont présentés. Cette page ne modifie aucune donnée.
      </p>
    </main>
  );
}
