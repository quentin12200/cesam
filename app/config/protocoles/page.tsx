export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { DEFAULT_PROTOCOLES } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Settings, Building2 } from "lucide-react";
import ProtocoleEditor from "./ProtocoleEditor";

async function getProtocoles() {
  let protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
  if (protocoles.length === 0) {
    await prisma.protocoleVaccin.createMany({
      data: DEFAULT_PROTOCOLES.map((p) => ({
        id: p.id,
        nom: p.nom,
        label: p.label,
        ordre: p.ordre,
        ageMinJours: p.ageMinJours,
        urgenceJours: p.urgenceJours,
        estRappel: p.estRappel,
        primoNom: p.primoNom,
        delaiRappelJours: p.delaiRappelJours,
        urgenceRappelJours: p.urgenceRappelJours,
        obligatoireVente: p.obligatoireVente,
        actif: p.actif,
      })),
    });
    protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
  }
  return protocoles;
}

export default async function ProtocolesConfigPage() {
  const protocoles = await getProtocoles();

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/sanitaire" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Settings size={20} className="text-gray-600" />
          <h2 className="text-xl font-bold text-gray-800">Protocoles vaccinaux</h2>
        </div>
        <Link href="/config/exploitation" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" title="Identité exploitation">
          <Building2 size={18} />
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        Configurez les délais et seuils d&apos;urgence pour chaque protocole vaccinal.
        Les modifications s&apos;appliquent immédiatement à tous les calculs.
      </p>

      <ProtocoleEditor protocoles={protocoles} />
    </div>
  );
}
