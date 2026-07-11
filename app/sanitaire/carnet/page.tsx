export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { getCarnetSanitaireRows, groupRowsByAnimal } from "@/lib/carnet-sanitaire";
import PrintButton from "@/app/components/PrintButton";

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

async function getExploitationConfig() {
  try {
    return await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

export default async function CarnetSanitairePage({ searchParams }: PageProps) {
  const { order: orderParam } = await searchParams;
  const order = orderParam === "animal" ? "animal" : "chrono";

  const [rows, config] = await Promise.all([getCarnetSanitaireRows(), getExploitationConfig()]);
  const printDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const groupes = order === "animal" ? groupRowsByAnimal(rows) : [];

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/sanitaire" className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
          <ArrowLeft size={16} /> Retour sanitaire
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/carnet-sanitaire?order=${order}`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="px-2 flex gap-2 print:hidden">
        <Link
          href="/sanitaire/carnet?order=chrono"
          className={`text-sm px-3 py-1.5 rounded-lg ${order === "chrono" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}
        >
          Chronologique
        </Link>
        <Link
          href="/sanitaire/carnet?order=animal"
          className={`text-sm px-3 py-1.5 rounded-lg ${order === "animal" ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}
        >
          Par animal
        </Link>
      </div>

      <div className="px-4 py-4 max-w-6xl mx-auto">
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{config?.raisonSociale ?? "GAEC Samuel & Céline"}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Carnet sanitaire</h1>
          <p className="text-xs text-gray-500 mt-1">
            {order === "chrono" ? "Ordre chronologique" : "Par animal"} — {rows.length} enregistrement{rows.length > 1 ? "s" : ""}
          </p>
          {config?.ipg && <p className="text-xs text-gray-400">IPG : {config.ipg}</p>}
          {config?.veterinaireNom && <p className="text-xs text-gray-400">Vétérinaire : {config.veterinaireNom}</p>}
          <p className="text-xs text-gray-300 mt-1">Édité le {printDate}</p>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Aucun enregistrement sanitaire</div>
        ) : order === "chrono" ? (
          <CarnetTable rows={rows} showAnimal />
        ) : (
          <div className="space-y-6">
            {groupes.map((g) => (
              <section key={g.animalNutrav}>
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
                  {g.animalNutrav}{g.animalNom ? ` — ${g.animalNom}` : ""}
                </h2>
                <CarnetTable rows={g.rows} showAnimal={false} />
              </section>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-300 mt-6 text-center print:block hidden">
          Document généré le {printDate} · CESAM TroupeauPro
        </p>
      </div>

      <style>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 9px; color: #111; }
          @page { size: A4 landscape; margin: 1.2cm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
}

function CarnetTable({ rows, showAnimal }: { rows: Awaited<ReturnType<typeof getCarnetSanitaireRows>>; showAnimal: boolean }) {
  return (
    <table className="w-full text-xs border-collapse mb-2">
      <thead>
        <tr className="bg-gray-100">
          <Th>Date</Th>
          {showAnimal && <Th>N° National</Th>}
          {showAnimal && <Th>N° Travail</Th>}
          {showAnimal && <Th>Nom</Th>}
          <Th>N° ordonnance</Th>
          <Th>Prescripteur</Th>
          <Th>Produit</Th>
          <Th>Dose</Th>
          <Th>Voie</Th>
          <Th>Motif</Th>
          <Th>Remise lait</Th>
          <Th>Remise viande</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="odd:bg-white even:bg-gray-50">
            <Td>{formatDate(r.date)}</Td>
            {showAnimal && <Td>{r.animalNational}</Td>}
            {showAnimal && <Td>{r.animalNutrav}</Td>}
            {showAnimal && <Td>{r.animalNom ?? "—"}</Td>}
            <Td>{r.ordonnanceNumero ?? "—"}</Td>
            <Td>{r.prescripteur ?? "—"}</Td>
            <Td>{r.produit}</Td>
            <Td>{r.dose || "—"}</Td>
            <Td>{r.voie ?? "—"}</Td>
            <Td>{r.motif ?? "—"}</Td>
            <Td>{formatDate(r.dateRemiseLait)}</Td>
            <Td>{formatDate(r.dateRemiseViande)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-gray-300 px-2 py-1 text-left font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border border-gray-300 px-2 py-1">{children}</td>;
}
