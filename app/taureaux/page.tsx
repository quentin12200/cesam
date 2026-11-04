export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import TaureauxClient from "./TaureauxClient";

import BackButton from "@/app/components/BackButton";
export default async function TaureauxPage() {
  const taureaux = await prisma.taureau.findMany({
    select: {
      id: true,
      nupere: true,
      nopere: true,
      present: true,
      _count: { select: { saillies: true } },
    },
    orderBy: { nopere: "asc" },
  });

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <h2 className="text-xl font-bold text-gray-800">Taureaux</h2>
      </div>
      <Link href="/taureaux/controle" className="inline-flex rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-bold text-green-900">Tableau des pères · Contrôler et corriger</Link>
      <Link href="/taureaux/doublons" className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Vérifier les doublons des reproducteurs</Link>
      <TaureauxClient initialTaureaux={taureaux} />
    </div>
  );
}
