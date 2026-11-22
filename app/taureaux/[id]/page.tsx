export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BackButton from "@/app/components/BackButton";
import BullIdentityEditor from "./BullIdentityEditor";
import { nationalWithCountry } from "@/lib/bull-identity";

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

  const gestations = await prisma.gestation.findMany({
    where: { saillie: { taureauId: bull.id }, velage: { is: null } },
    select: {
      id: true, etat: true, resultatEcho: true, dateVelagePrevue: true,
      saillie: { select: {
        date: true, type: true, estimation: true,
        animal: { select: { id: true, nutrav: true, nobovi: true, statut: true } },
      } },
    },
    orderBy: { dateVelagePrevue: "asc" },
  });
  const futures = gestations.filter(g => g.saillie.animal.statut === "ACTIF");
  const confirmed = futures.filter(g => !g.saillie.estimation && /^(VERT|GESTANTE|PLEINE|POSITIF)$/i.test(g.etat));
  const uncertain = futures.filter(g => !confirmed.includes(g));
  const dateFr = (date: Date | null) => date ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(date) : "Non renseignée";

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
          <p className="text-xs text-gray-500">N° national : {nationalWithCountry(bull.nupere) || "Non renseigné"}</p>
          <p className="text-xs text-gray-500">N° de travail : {(/\d{4}$/.exec(bull.nupere?.replace(/\s+/g, "") ?? "")?.[0] ?? "Non renseigné")}</p>
          <BullIdentityEditor id={bull.id} name={bull.nopere} national={bull.nupere} />
        </div>
      </div>
      <p className="text-sm text-gray-600">{offspring.length} descendants directs · {present.length} présents · {absent.length} sortis</p>
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Futurs descendants ({futures.length})</h2>
        {([{ title: "Gestations confirmées", rows: confirmed }, { title: "Gestations à vérifier", rows: uncertain }]).map(group => (
          <div key={group.title} className="mb-3">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{group.title} ({group.rows.length})</h3>
            {group.rows.length === 0 && <p className="text-sm text-gray-400">Aucune.</p>}
            <div className="space-y-2">{group.rows.map(g => (
              <Link key={g.id} href={`/troupeau/${g.saillie.animal.nutrav}`} className="block rounded-lg border bg-gray-50 p-3 text-sm">
                <strong>{g.saillie.animal.nutrav}{g.saillie.animal.nobovi ? ` · ${g.saillie.animal.nobovi}` : ""}</strong>
                <span className="block">Saillie / IA : {dateFr(g.saillie.date)} · {g.saillie.type}</span>
                <span className="block">Vêlage prévu : {dateFr(g.dateVelagePrevue)}</span>
                <span className="block">Statut : {g.etat}{g.resultatEcho ? ` · Écho : ${g.resultatEcho}` : ""}{g.saillie.estimation ? " · Date estimée" : ""}</span>
              </Link>
            ))}</div>
          </div>
        ))}
        <p className="text-xs text-gray-500">Seules les gestations liées explicitement à ce père sont affichées. Les références historiques par nom ne sont pas attribuées automatiquement.</p>
      </section>
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
