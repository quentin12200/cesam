export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { differenceInDays, addDays } from "date-fns";
import { formatAge, getVaccinProtocolSteps, DEFAULT_PROTOCOLES, type ProtocoleVaccinConfig } from "@/lib/utils";
import PrintButton from "@/app/components/PrintButton";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

async function getProtocoles(): Promise<ProtocoleVaccinConfig[]> {
  try {
    const rows = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
    if (rows.length > 0) return rows;
  } catch { /* fallback */ }
  return DEFAULT_PROTOCOLES;
}

async function getExploitationConfig() {
  try {
    return await prisma.exploitationConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

export default async function SanitaireImpressionPage() {
  const [protocoles, animaux, config, traitementsRaw] = await Promise.all([
    getProtocoles(),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      include: { vaccinations: { orderBy: { date: "asc" } } },
      orderBy: { danais: "asc" },
    }),
    getExploitationConfig(),
    prisma.traitement.findMany({
      where: {
        OR: [
          { statut: "EN_COURS" },
          { statut: "TERMINE", dateDebut: { gte: addDays(new Date(), -90) } },
        ],
      },
      include: {
        animal: { select: { nutrav: true, nobovi: true } },
        medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
      },
      orderBy: { dateDebut: "desc" },
      take: 100,
    }),
  ]);

  const now = new Date();
  const printDate = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const jeunes = animaux.filter((a) => differenceInDays(now, a.danais) <= 365 * 2);
  const actifs = protocoles.filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);

  const exploitationNom = config?.raisonSociale ?? "GAEC Samuel & Céline";
  const exploitationIPG = config?.ipg;
  const vetNom = config?.veterinaireNom;
  const vetTel = config?.veterinaireTel;

  return (
    <>
      <div className="p-4 flex items-center justify-between print:hidden">
        <Link href="/sanitaire" className="text-sm text-gray-600 hover:text-gray-800">← Retour sanitaire</Link>
        <PrintButton />
      </div>

      <div className="px-6 pb-8 max-w-5xl mx-auto">
        {/* En-tête exploitation */}
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">{exploitationNom}</h1>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
            {exploitationIPG && <span>IPG : {exploitationIPG}</span>}
            {config?.telephone && <span>Tél : {config.telephone}</span>}
            {config?.adresse && <span>{config.adresse}</span>}
          </div>
          {(vetNom || vetTel) && (
            <div className="text-xs text-gray-400 mt-1">
              Vétérinaire : {vetNom ?? "—"}{vetTel ? ` · ${vetTel}` : ""}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2 font-semibold uppercase tracking-wide">
            Carnet sanitaire — Protocoles vaccinaux
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Imprimé le {printDate} · {jeunes.length} animal{jeunes.length > 1 ? "s" : ""} (moins de 2 ans)
          </p>
        </div>

        {/* Table vaccinations */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">N° travail</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Nom</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Âge</th>
              {actifs.map((p) => (
                <th key={p.id} className="border border-gray-400 px-2 py-1.5 text-center font-bold min-w-[70px]">
                  {p.label}
                </th>
              ))}
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {jeunes.map((animal, i) => {
              const steps = getVaccinProtocolSteps(animal.danais, animal.vaccinations, protocoles);
              const stepsMap = Object.fromEntries(steps.map((s) => [s.vaccin, s]));
              const dueCount = steps.filter((s) => s.status === "due").length;
              const urgentCount = steps.filter((s) => s.status === "due" && s.isUrgent).length;
              const rowBg = urgentCount > 0 ? "bg-red-50" : dueCount > 0 ? "bg-yellow-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";

              return (
                <tr key={animal.id} className={rowBg}>
                  <td className="border border-gray-300 px-2 py-1 font-mono font-bold text-green-800">{animal.nutrav}</td>
                  <td className="border border-gray-300 px-2 py-1">{animal.nobovi ?? "—"}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{formatAge(animal.danais)}</td>
                  {actifs.map((p) => {
                    const step = stepsMap[p.nom];
                    if (!step) return <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-300">—</td>;
                    if (step.status === "done") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-green-700 font-medium">
                        ✓ {step.doneDate ? fmt(step.doneDate) : ""}
                      </td>
                    );
                    if (step.status === "not_eligible") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-400 text-xs">
                        {step.eligibleDate ? `Élig. ${fmt(step.eligibleDate)}` : "N/A"}
                      </td>
                    );
                    return (
                      <td key={p.id} className={`border border-gray-300 px-2 py-1 text-center font-medium ${step.isUrgent ? "text-red-700 bg-red-100" : "text-orange-600"}`}>
                        {step.isUrgent ? "⚠ URGENT" : "À faire"}
                      </td>
                    );
                  })}
                  <td className={`border border-gray-300 px-2 py-1 text-center font-bold text-xs ${
                    urgentCount > 0 ? "text-red-700" : dueCount > 0 ? "text-orange-600" : "text-green-700"
                  }`}>
                    {urgentCount > 0 ? `${urgentCount} urgent${urgentCount > 1 ? "s" : ""}` :
                     dueCount > 0 ? `${dueCount} à faire` : "Complet"}
                  </td>
                </tr>
              );
            })}
            {jeunes.length === 0 && (
              <tr>
                <td colSpan={actifs.length + 4} className="border border-gray-300 px-3 py-8 text-center text-gray-400">
                  Aucun animal de moins de 2 ans
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-3 flex gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-50 border border-red-200 rounded" /> Urgent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-50 border border-yellow-200 rounded" /> À planifier</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border border-gray-300 rounded" /> Complet</span>
        </div>

        {/* Section traitements */}
        {traitementsRaw.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-300 pb-2">
              Traitements — 90 derniers jours
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Animal</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Médicament</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Début</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Durée</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Fin traitement</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Fin attente viande</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Motif</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {traitementsRaw.map((t, i) => {
                  const debut = new Date(t.dateDebut);
                  const fin = addDays(debut, t.dureeJours);
                  const delaiViande = t.medicament?.delaiAttenteViandeJ ?? null;
                  const finAttente = delaiViande != null ? addDays(fin, delaiViande + 1) : null;
                  const enCours = now < fin && t.statut === "EN_COURS";
                  const enAttente = finAttente != null ? now < finAttente : false;

                  return (
                    <tr key={t.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${enCours ? "bg-blue-50" : enAttente ? "bg-orange-50" : ""}`}>
                      <td className="border border-gray-300 px-2 py-1">
                        <span className="font-mono font-bold text-green-800">{t.animal.nutrav}</span>
                        {t.animal.nobovi && <span className="ml-1 text-gray-600">{t.animal.nobovi}</span>}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 font-medium">{t.medicamentNom}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{fmt(debut)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.dureeJours}j</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{fmt(fin)}</td>
                      <td className={`border border-gray-300 px-2 py-1 text-center ${enAttente ? "font-bold text-orange-700" : ""}`}>
                        {finAttente ? fmt(finAttente) : "—"}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-gray-500">{t.motif ?? "—"}</td>
                      <td className={`border border-gray-300 px-2 py-1 text-center font-medium text-xs ${
                        enCours ? "text-blue-700" : enAttente ? "text-orange-700" : "text-green-700"
                      }`}>
                        {enCours ? "En cours" : enAttente ? "Attente" : "Terminé"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { font-size: 9px; }
          @page { size: A4 landscape; margin: 1cm; }
          table { width: 100%; }
          th, td { padding: 3px 5px !important; }
          .bg-red-50 { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-red-100 { background-color: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-yellow-50 { background-color: #fefce8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-orange-50 { background-color: #fff7ed !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
