import BackButton from "@/app/components/BackButton";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import {
  getCarnetSanitaireRows, groupRowsByAnimal, type CarnetSanitaireRow,
  getEvenementsCarnetRows, groupEvenementsByAnimal, type EvenementCarnetRow,
} from "@/lib/carnet-sanitaire";
import { getCategorieLabel } from "@/lib/evenements-sanitaires";
import PrintButton from "@/app/components/PrintButton";
import ConfirmDeleteButton from "@/app/components/ConfirmDeleteButton";
import ImportHistoriqueButton from "./ImportHistoriqueButton";

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

  const [rows, evenements, config] = await Promise.all([
    getCarnetSanitaireRows(),
    getEvenementsCarnetRows(),
    getExploitationConfig(),
  ]);
  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const groupes = order === "animal" ? groupRowsByAnimal(rows) : [];
  const groupesEvenements = order === "animal" ? groupEvenementsByAnimal(evenements) : [];

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <BackButton label="Retour" className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1" />
        <div className="flex items-center gap-2">
          <a
            href={`/api/carnet-sanitaire?order=${order}`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            title="CSV traitements et vaccinations"
          >
            <Download size={14} /> CSV
          </a>
          <a
            href={`/api/carnet-sanitaire/evenements?order=${order}`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            title="CSV événements sanitaires"
          >
            <Download size={14} /> CSV événements
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="px-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/sanitaire/carnet?order=chrono"
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${order === "chrono" ? "bg-green-700 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
        >
          Chronologique
        </Link>
        <Link
          href="/sanitaire/carnet?order=animal"
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${order === "animal" ? "bg-green-700 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
        >
          Par animal
        </Link>
        <div className="ml-auto">
          <ImportHistoriqueButton />
        </div>
      </div>

      <div className="px-4 py-4 max-w-6xl mx-auto">
        <div className="mb-6 rounded-xl overflow-hidden shadow-sm border border-green-800 print:border-2">
          <div className="bg-green-700 text-white px-6 py-5 text-center">
            <p className="text-xs uppercase tracking-widest text-green-100">{config?.raisonSociale ?? "GAEC Samuel & Céline"}</p>
            <h1 className="text-2xl font-bold mt-1">Carnet sanitaire</h1>
            <p className="text-xs text-green-100 mt-1">
              {order === "chrono" ? "Ordre chronologique" : "Par animal"} — {rows.length} enregistrement{rows.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-green-50 px-6 py-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-green-900">
            {config?.ipg && <span>IPG : {config.ipg}</span>}
            {config?.veterinaireNom && <span>Vétérinaire : {config.veterinaireNom}</span>}
            <span>Édité le {printDate}</span>
          </div>
        </div>

        {rows.length === 0 && evenements.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Aucun enregistrement sanitaire</div>
        ) : order === "chrono" ? (
          <>
            {rows.length > 0 && <CarnetTable rows={rows} showAnimal now={now} />}
            {evenements.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-6 mb-2">Événements sanitaires</h2>
                <EvenementsTable rows={evenements} showAnimal />
              </>
            )}
          </>
        ) : (
          <div className="space-y-5">
            {animauxUnion(groupes, groupesEvenements).map(({ animalNutrav, animalNom }) => {
              const g = groupes.find((x) => x.animalNutrav === animalNutrav);
              const ge = groupesEvenements.find((x) => x.animalNutrav === animalNutrav);
              return (
                <section key={animalNutrav} className="rounded-lg overflow-hidden border border-gray-200">
                  <h2 className="text-sm font-bold text-white bg-gray-700 uppercase tracking-wide px-3 py-1.5">
                    {animalNutrav}{animalNom ? ` — ${animalNom}` : ""}
                  </h2>
                  {g && <CarnetTable rows={g.rows} showAnimal={false} now={now} />}
                  {ge && <EvenementsTable rows={ge.rows} showAnimal={false} />}
                </section>
              );
            })}
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
          .bg-green-700 { background-color: #15803d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-green-50 { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-green-100 { background-color: #dcfce7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-700 { background-color: #374151 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-orange-100 { background-color: #ffedd5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-white { color: #fff !important; }
          .text-green-100 { color: #dcfce7 !important; }
        }
      `}</style>
    </>
  );
}

function animauxUnion(
  a: { animalNutrav: string; animalNom: string | null }[],
  b: { animalNutrav: string; animalNom: string | null }[]
): { animalNutrav: string; animalNom: string | null }[] {
  const map = new Map<string, string | null>();
  for (const x of [...a, ...b]) map.set(x.animalNutrav, x.animalNom);
  return Array.from(map.entries())
    .map(([animalNutrav, animalNom]) => ({ animalNutrav, animalNom }))
    .sort((x, y) => x.animalNutrav.localeCompare(y.animalNutrav, undefined, { numeric: true }));
}

function EvenementsTable({ rows, showAnimal }: { rows: EvenementCarnetRow[]; showAnimal: boolean }) {
  return (
    <table className="w-full text-xs border-collapse mb-2">
      <thead>
        <tr className="bg-gray-700 text-white">
          <Th>Date</Th>
          {showAnimal && <Th>N° Travail</Th>}
          {showAnimal && <Th>Nom</Th>}
          <Th>Catégorie</Th>
          <Th>Événement</Th>
          <Th>Commentaire</Th>
          <Th>Constaté par</Th>
          <Th>Statut</Th>
          <Th className="print:hidden"></Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="odd:bg-white even:bg-gray-50">
            <Td>{formatDate(r.date)}{r.moment ? ` (${r.moment})` : ""}</Td>
            {showAnimal && <Td>{r.animalNutrav}</Td>}
            {showAnimal && <Td>{r.animalNom ?? "—"}</Td>}
            <Td>{getCategorieLabel(r.categorie)}</Td>
            <Td className="font-medium">
              {r.symptomes.length > 1 ? r.symptomes.join(" • ") : r.type}
              {r.temperature != null ? ` (${r.temperature}°C)` : ""}
            </Td>
            <Td>{r.description ?? "—"}</Td>
            <Td>{r.constatePar ?? "—"}</Td>
            <Td className={!r.resolu ? "font-semibold text-red-700" : ""}>{r.resolu ? "Résolu" : "En cours"}</Td>
            <Td className="print:hidden">
              <ConfirmDeleteButton url={`/api/evenements/${r.id}`} />
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CarnetTable({ rows, showAnimal, now }: { rows: CarnetSanitaireRow[]; showAnimal: boolean; now: Date }) {
  return (
    <table className="w-full text-xs border-collapse mb-2">
      <thead>
        <tr className="bg-green-700 text-white">
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
        {rows.map((r) => {
          const isVaccination = r.motif === "VACCINATION";
          const laitEnAttente = r.dateRemiseLait ? now < r.dateRemiseLait : false;
          const viandeEnAttente = r.dateRemiseViande ? now < r.dateRemiseViande : false;
          return (
            <tr key={r.id} className={isVaccination ? "odd:bg-white even:bg-blue-50" : "odd:bg-white even:bg-gray-50"}>
              <Td>{formatDate(r.date)}</Td>
              {showAnimal && <Td>{r.animalNational}</Td>}
              {showAnimal && <Td>{r.animalNutrav}</Td>}
              {showAnimal && <Td>{r.animalNom ?? "—"}</Td>}
              <Td>{r.ordonnanceNumero ?? "—"}</Td>
              <Td>{r.prescripteur ?? "—"}</Td>
              <Td className="font-medium">{r.produit}</Td>
              <Td>{r.dose || "—"}</Td>
              <Td>{r.voie ?? "—"}</Td>
              <Td>{r.motif ?? "—"}</Td>
              <Td className={laitEnAttente ? "bg-orange-100 font-semibold text-orange-800" : ""}>{formatDate(r.dateRemiseLait)}</Td>
              <Td className={viandeEnAttente ? "bg-orange-100 font-semibold text-orange-800" : ""}>{formatDate(r.dateRemiseViande)}</Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`border border-green-800 px-2 py-1.5 text-left font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-gray-300 px-2 py-1 ${className}`}>{children}</td>;
}
