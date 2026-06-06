"use client";

import { useState, useMemo } from "react";
import { getVaccinProtocolSteps, formatAgeCompact, type ProtocoleVaccinConfig } from "@/lib/utils";
import { addDays } from "date-fns";

interface AnimalRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  danais: Date;
  vaccinations: { id: string; vaccin: string; date: Date }[];
}

interface TraitementRow {
  id: string;
  animalNutrav: string;
  animalNobovi: string | null;
  medicamentNom: string;
  dateDebut: Date;
  dureeJours: number;
  motif: string | null;
  statut: string;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
}

interface Props {
  animaux: AnimalRow[];
  protocoles: ProtocoleVaccinConfig[];
  traitements: TraitementRow[];
  exploitationNom: string;
  exploitationIPG?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  vetNom?: string | null;
  vetTel?: string | null;
  printDate: string;
}

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function ImpressionClient({
  animaux,
  protocoles,
  traitements,
  exploitationNom,
  exploitationIPG,
  telephone,
  adresse,
  vetNom,
  vetTel,
  printDate,
}: Props) {
  const actifs = protocoles.filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);

  const [selectedAnimaux, setSelectedAnimaux] = useState<Set<string>>(
    new Set(animaux.map((a) => a.id))
  );
  const [selectedProtocoles, setSelectedProtocoles] = useState<Set<string>>(
    new Set(actifs.map((p) => p.id))
  );

  const filteredAnimaux = animaux.filter((a) => selectedAnimaux.has(a.id));
  const filteredProtocoles = actifs.filter((p) => selectedProtocoles.has(p.id));

  function toggleAnimal(id: string) {
    setSelectedAnimaux((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllAnimaux(select: boolean) {
    setSelectedAnimaux(select ? new Set(animaux.map((a) => a.id)) : new Set());
  }

  function toggleProtocole(id: string) {
    setSelectedProtocoles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const now = new Date();

  return (
    <>
      {/* Controls — print:hidden */}
      <div className="print:hidden space-y-4 mb-6">
        {/* Animal selection */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Animaux ({selectedAnimaux.size}/{animaux.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAllAnimaux(true)}
                className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Tous
              </button>
              <button
                onClick={() => toggleAllAnimaux(false)}
                className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Aucun
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {animaux.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAnimal(a.id)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-mono font-bold transition-colors ${
                  selectedAnimaux.has(a.id)
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-gray-50 text-gray-500 border-gray-200 line-through"
                }`}
              >
                {a.nutrav}
              </button>
            ))}
          </div>
        </div>

        {/* Protocol filter */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Protocoles ({selectedProtocoles.size}/{actifs.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {actifs.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProtocole(p.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  selectedProtocoles.has(p.id)
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-gray-50 text-gray-400 border-gray-200 line-through"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full py-3 bg-green-700 text-white rounded-xl font-bold text-sm hover:bg-green-800 transition-colors"
        >
          Imprimer ({filteredAnimaux.length > 1 ? `${filteredAnimaux.length} animaux` : `${filteredAnimaux.length} animal`}, {filteredProtocoles.length} protocole{filteredProtocoles.length > 1 ? "s" : ""})
        </button>
      </div>

      {/* Printable content */}
      <div className="px-2 pb-8 max-w-5xl mx-auto">
        {/* En-tête exploitation */}
        <div className="text-center mb-5 border-b border-gray-300 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">{exploitationNom}</h1>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
            {exploitationIPG && <span>IPG : {exploitationIPG}</span>}
            {telephone && <span>Tél : {telephone}</span>}
            {adresse && <span>{adresse}</span>}
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
            Imprimé le {printDate} · {filteredAnimaux.length > 1 ? `${filteredAnimaux.length} animaux` : `${filteredAnimaux.length} animal`}
          </p>
        </div>

        {/* Table vaccinations */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left font-bold whitespace-nowrap">N° travail</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold whitespace-nowrap">Âge</th>
              {filteredProtocoles.map((p) => (
                <th key={p.id} className="border border-gray-400 px-2 py-1.5 text-center font-bold min-w-[70px]">
                  {p.label}
                </th>
              ))}
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Statut</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center font-bold w-8">□</th>
            </tr>
          </thead>
          <tbody>
            {filteredAnimaux.map((animal, i) => {
              const steps = getVaccinProtocolSteps(animal.danais, animal.vaccinations, protocoles);
              const stepsMap = Object.fromEntries(steps.map((s) => [s.vaccin, s]));
              const dueCount = steps.filter((s) => s.status === "due").length;
              const urgentCount = steps.filter((s) => s.status === "due" && s.isUrgent).length;
              const rowBg = urgentCount > 0 ? "bg-red-50" : dueCount > 0 ? "bg-yellow-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";

              return (
                <tr key={animal.id} className={rowBg}>
                  <td className="border border-gray-300 px-2 py-1 font-mono font-bold text-green-800 whitespace-nowrap">{animal.nutrav}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">{formatAgeCompact(animal.danais)}</td>
                  {filteredProtocoles.map((p) => {
                    const step = stepsMap[p.nom];
                    if (!step) return <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-300">—</td>;
                    if (step.status === "done") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-green-700 font-medium whitespace-nowrap">
                        ✓ {step.doneDate ? fmt(step.doneDate) : ""}
                      </td>
                    );
                    if (step.status === "not_eligible") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-400 whitespace-nowrap">
                        {step.eligibleDate ? `Élig. ${fmt(step.eligibleDate)}` : "N/A"}
                      </td>
                    );
                    if (step.status === "pending") return (
                      <td key={p.id} className="border border-gray-300 px-2 py-1 text-center text-gray-400 whitespace-nowrap">
                        ⏳ {step.eligibleDate ? fmt(step.eligibleDate) : ""}
                      </td>
                    );
                    return (
                      <td key={p.id} className={`border border-gray-300 px-2 py-1 text-center font-medium whitespace-nowrap ${step.isUrgent ? "text-red-700 bg-red-100" : "text-orange-600"}`}>
                        {step.isUrgent ? "⚠ URGENT" : "À faire"}
                        {step.dueFrom && <span className="block text-xs opacity-70">{fmt(step.dueFrom)}</span>}
                      </td>
                    );
                  })}
                  <td className={`border border-gray-300 px-2 py-1 text-center font-bold text-xs whitespace-nowrap ${
                    urgentCount > 0 ? "text-red-700" : dueCount > 0 ? "text-orange-600" : "text-green-700"
                  }`}>
                    {urgentCount > 0 ? `${urgentCount} urgent${urgentCount > 1 ? "s" : ""}` :
                     dueCount > 0 ? `${dueCount} à faire` : "Complet"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center text-gray-300">□</td>
                </tr>
              );
            })}
            {filteredAnimaux.length === 0 && (
              <tr>
                <td colSpan={filteredProtocoles.length + 4} className="border border-gray-300 px-3 py-8 text-center text-gray-400">
                  Aucun animal sélectionné
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
        {traitements.length > 0 && (
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
                {traitements.map((t, i) => {
                  const debut = new Date(t.dateDebut);
                  const fin = addDays(debut, t.dureeJours);
                  const finAttente = t.delaiAttenteViandeJ != null ? addDays(fin, t.delaiAttenteViandeJ + 1) : null;
                  const enCours = now < fin && t.statut === "EN_COURS";
                  const enAttente = finAttente != null ? now < finAttente : false;

                  return (
                    <tr key={t.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${enCours ? "bg-blue-50" : enAttente ? "bg-orange-50" : ""}`}>
                      <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                        <span className="font-mono font-bold text-green-800">{t.animalNutrav}</span>
                      </td>
                      <td className="border border-gray-300 px-2 py-1 font-medium">{t.medicamentNom}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">{fmt(debut)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{t.dureeJours}j</td>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">{fmt(fin)}</td>
                      <td className={`border border-gray-300 px-2 py-1 text-center whitespace-nowrap ${enAttente ? "font-bold text-orange-700" : ""}`}>
                        {finAttente ? fmt(finAttente) : "—"}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-gray-500">{t.motif ?? "—"}</td>
                      <td className={`border border-gray-300 px-2 py-1 text-center font-medium text-xs whitespace-nowrap ${
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
