export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import PrintButton from "@/app/components/PrintButton";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default async function PharmacieImpressionPage() {
  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const traitements = await prisma.traitement.findMany({
    include: {
      animal: { select: { nutrav: true, nobovi: true } },
      medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
    },
    orderBy: { dateDebut: "desc" },
  });

  const actifs = traitements
    .map((t) => {
      const dateFin = addDays(new Date(t.dateDebut), t.dureeJours);
      const attente = getAttenteInfoForTraitement(t, now);
      const delaiViande = t.delaiAttenteViandeJ ?? t.medicament?.delaiAttenteViandeJ ?? null;
      const dateFinAttente = attente.dateFinAttenteViande ?? dateFin;
      const enCours = now < dateFin;
      const enAttente = enCours || attente.enAttenteViande;
      return { ...t, dateFin, dateFinAttente, delaiViande, enCours, enAttente, joursRestants: differenceInDays(dateFinAttente, now) };
    })
    .filter((t) => t.enCours || t.enAttente)
    .sort((a, b) => a.joursRestants - b.joursRestants);

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/pharmacie" className="text-sm text-gray-600 hover:text-gray-800">← Retour pharmacie</Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-4xl mx-auto">
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">GAEC Samuel &amp; Céline</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Traitements en cours &amp; délais d&apos;attente</h1>
          <p className="text-xs text-gray-400 mt-1">Imprimé le {printDate} · {actifs.length} traitement{actifs.length > 1 ? "s" : ""} actif{actifs.length > 1 ? "s" : ""}</p>
        </div>

        {actifs.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-3 py-2 text-left font-bold">Animal</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-bold">Médicament</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Début</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Durée</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Fin traitement</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Fin attente viande</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Motif</th>
                <th className="border border-gray-400 px-3 py-2 text-center font-bold">Vétérinaire</th>
              </tr>
            </thead>
            <tbody>
              {actifs.map((t, i) => (
                <tr key={t.id} className={t.enCours ? (i % 2 === 0 ? "bg-blue-50" : "bg-white") : (i % 2 === 0 ? "bg-orange-50" : "bg-white")}>
                  <td className="border border-gray-300 px-3 py-1.5">
                    <span className="font-mono font-bold text-green-800">{t.animal.nutrav}</span>
                    {t.animal.nobovi && <span className="ml-1 text-gray-600">{t.animal.nobovi}</span>}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 font-medium">{t.medicamentNom}</td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center">{fmt(t.dateDebut)}</td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center">{t.dureeJours}j</td>
                  <td className="border border-gray-300 px-3 py-1.5 text-center font-medium">
                    {fmt(t.dateFin)}
                    {t.enCours && <span className="ml-1 text-xs text-blue-600">(en cours)</span>}
                  </td>
                  <td className={`border border-gray-300 px-3 py-1.5 text-center font-bold ${t.joursRestants > 0 ? "text-orange-700" : "text-green-700"}`}>
                    {t.delaiViande != null ? (
                      <>
                        {fmt(t.dateFinAttente)}
                        {t.joursRestants > 0 && <span className="block text-xs">J-{t.joursRestants}</span>}
                      </>
                    ) : "Aucune"}
                  </td>
                  <td className="border border-gray-300 px-3 py-1.5 text-xs text-gray-600">{t.motif ?? "—"}</td>
                  <td className="border border-gray-300 px-3 py-1.5 text-xs text-gray-600">{t.veterinaire ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center py-8 text-gray-400">Aucun traitement en cours ou en délai d&apos;attente</p>
        )}

        <div className="mt-4 flex gap-6 text-xs text-gray-500">
          <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-200 rounded mr-1" />Traitement actif</span>
          <span><span className="inline-block w-3 h-3 bg-orange-50 border border-orange-200 rounded mr-1" />Délai d&apos;attente viande</span>
        </div>

        <p className="text-xs text-gray-300 mt-6 text-center">
          Document généré le {printDate} · CESAM TroupeauPro
        </p>
      </div>

      <style>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 10px; }
          @page { size: A4 landscape; margin: 1.5cm; }
          .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-orange-50 { background-color: #fff7ed !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
