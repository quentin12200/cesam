export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pill } from "lucide-react";
import { prisma } from "@/lib/prisma";
import MedicamentFicheClient from "./MedicamentFicheClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MedicamentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [medicament, traitements] = await Promise.all([
    prisma.medicament.findUnique({
      where: { id },
      include: {
        preconisations: { orderBy: { createdAt: "asc" } },
        termes: { orderBy: { ordre: "asc" } },
      },
    }),
    prisma.traitement.findMany({
      where: { medicamentId: id },
      include: {
        animal: { select: { nutrav: true, nobovi: true } },
        ordonnance: { select: { id: true, numero: true, date: true, veterinaireNom: true, statut: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
  ]);

  if (!medicament) notFound();

  const ordonnancesMap = new Map<string, { id: string; numero: string | null; date: string; veterinaireNom: string | null; statut: string }>();
  for (const t of traitements) {
    if (t.ordonnance && !ordonnancesMap.has(t.ordonnance.id)) {
      ordonnancesMap.set(t.ordonnance.id, {
        id: t.ordonnance.id,
        numero: t.ordonnance.numero,
        date: t.ordonnance.date.toISOString(),
        veterinaireNom: t.ordonnance.veterinaireNom,
        statut: t.ordonnance.statut,
      });
    }
  }

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

      <MedicamentFicheClient
        medicament={{
          id: medicament.id,
          nom: medicament.nom,
          dci: medicament.dci,
          forme: medicament.forme,
          categorie: medicament.categorie,
          voie: medicament.voie,
          prescriptionRequise: medicament.prescriptionRequise,
          actif: medicament.actif,
          favori: medicament.favori,
          actions: medicament.actions,
          commentaire: medicament.commentaire,
          delaiAttenteViandeJ: medicament.delaiAttenteViandeJ,
          stockActuel: medicament.stockActuel,
          stockUnite: medicament.stockUnite,
          stockSeuilAlert: medicament.stockSeuilAlert,
          delaiAttenteLaitJ: medicament.delaiAttenteLaitJ,
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
        termes={medicament.termes.map((t) => ({ id: t.id, terme: t.terme, explication: t.explication }))}
        ordonnances={Array.from(ordonnancesMap.values())}
        historique={traitements.map((t) => ({
          id: t.id,
          animalNutrav: t.animal.nutrav,
          animalNom: t.animal.nobovi,
          dateDebut: t.dateDebut.toISOString(),
          dose: t.dose,
          uniteDosage: t.uniteDosage,
          voie: t.voie,
          motif: t.motif,
          statut: t.statut,
        }))}
      />
    </div>
  );
}
