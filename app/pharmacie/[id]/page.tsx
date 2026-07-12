export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pill } from "lucide-react";
import { prisma } from "@/lib/prisma";
import MedicamentDetailClient from "./MedicamentDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MedicamentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const medicament = await prisma.medicament.findUnique({
    where: { id },
    include: { preconisations: { orderBy: { createdAt: "asc" } } },
  });

  if (!medicament) notFound();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/pharmacie" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Pill size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">{medicament.nom}</h2>
        </div>
      </div>

      <MedicamentDetailClient
        medicament={{
          id: medicament.id,
          nom: medicament.nom,
          dci: medicament.dci,
          forme: medicament.forme,
          categorie: medicament.categorie,
          voie: medicament.voie,
          prescriptionRequise: medicament.prescriptionRequise,
          actif: medicament.actif,
          commentaire: medicament.commentaire,
        }}
        preconisations={medicament.preconisations.map((p) => ({
          id: p.id,
          indicationMotif: p.indicationMotif,
          categorieAnimaux: p.categorieAnimaux,
          agePoidsConcerne: p.agePoidsConcerne,
          dose: p.dose,
          unite: p.unite,
          doseBase: p.doseBase,
          voie: p.voie,
          frequence: p.frequence,
          dureeValeur: p.dureeValeur,
          dureeUnite: p.dureeUnite,
          nombreAdministrations: p.nombreAdministrations,
          precautions: p.precautions,
          delaiAttenteViandeJ: p.delaiAttenteViandeJ,
          delaiAttenteLaitTraites: p.delaiAttenteLaitTraites,
          source: p.source,
          statut: p.statut,
          commentaireVerification: p.commentaireVerification,
        }))}
      />
    </div>
  );
}
