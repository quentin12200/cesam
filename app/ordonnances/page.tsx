export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import OrdonnancesClient, { type OrdonnanceItem } from "./OrdonnancesClient";

async function getOrdonnances(): Promise<OrdonnanceItem[]> {
  const rows = await prisma.ordonnance.findMany({
    orderBy: { date: "desc" },
    take: 200,
  });
  return rows.map((o) => ({
    id: o.id,
    date: o.date.toISOString(),
    numero: o.numero,
    veterinaireNom: o.veterinaireNom,
    medicamentNom: o.medicamentNom,
    dose: o.dose,
    uniteDosage: o.uniteDosage,
    voie: o.voie,
    dureeJours: o.dureeJours,
    motif: o.motif,
    animaux: o.animaux,
    statut: o.statut,
    notes: o.notes,
  }));
}

export default async function OrdonnancesPage() {
  const ordonnances = await getOrdonnances();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/sanitaire" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <FileText size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Ordonnances</h2>
        </div>
        <span className="text-sm text-gray-400">{ordonnances.filter((o) => o.statut !== "ARCHIVE").length} active{ordonnances.filter((o) => o.statut !== "ARCHIVE").length > 1 ? "s" : ""}</span>
      </div>

      <OrdonnancesClient ordonnances={ordonnances} />
    </div>
  );
}
