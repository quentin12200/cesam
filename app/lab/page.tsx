import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getGestationCalendar } from "@/lib/gestation-calendar";
import LabExplorer from "./LabExplorer";

export const dynamic = "force-dynamic";

export default async function CesamLabPage() {
  const [animaux, echeances] = await Promise.all([
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: { id: true, nutrav: true, nobovi: true, sexbov: true, aEchographier: true },
      orderBy: { nutrav: "asc" },
    }),
    getGestationCalendar(),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-28">
      <header className="rounded-2xl bg-green-800 p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div><span className="rounded-full bg-white/20 px-2 py-1 text-xs font-bold">PROTOTYPE · LECTURE SEULE</span><h1 className="mt-3 text-2xl font-black">CESAM LAB</h1><p className="mt-1 text-sm text-green-50">Essayons une autre façon de travailler.</p></div>
          <Link href="/config" className="rounded-xl border border-white/50 px-3 py-2 text-sm font-bold text-white">← Retour à CESAM</Link>
        </div>
      </header>
      <LabExplorer
        animaux={animaux}
        echeances={echeances.map((row) => ({ id: row.id, nutrav: row.nutrav, nom: row.nobovi, date: row.dateVelagePrevue.toISOString() }))}
      />
      <p className="text-xs text-gray-500">Cet espace n’enregistre aucun acte et n’altère aucun animal. Les actions de terrain sont présentées ici uniquement pour tester la navigation.</p>
    </main>
  );
}
