"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, History, AlertTriangle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface TraitementItem {
  id: string;
  animalNutrav: string;
  animalNom: string | null;
  medicamentNom: string;
  medicamentId: string | null;
  dateDebut: string;
  dateFin: string;
  dureeJours: number;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  motif: string | null;
  veterinaire: string | null;
  statut: string;
  notes: string | null;
  delaiAttenteViandeJ: number | null;
  dateFinAttente: string | null;
  enCours: boolean;
  enAttente: boolean;
  joursRestantsAttente: number | null;
}

function EnCoursTab({ traitements, onRefresh }: { traitements: TraitementItem[]; onRefresh: () => void }) {
  const actifs = traitements.filter((t) => t.enCours || t.enAttente);
  const router = useRouter();

  async function terminer(id: string) {
    await fetch(`/api/traitements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "TERMINE" }),
    });
    onRefresh();
    router.refresh();
  }

  if (actifs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircle2 size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun traitement en cours</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actifs.map((t) => (
        <div key={t.id} className={`bg-white rounded-xl shadow border p-4 border-l-4 ${
          t.enCours ? "border-blue-400" : t.joursRestantsAttente && t.joursRestantsAttente > 0 ? "border-orange-400" : "border-gray-200"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/troupeau/${t.animalNutrav}`}
                  className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 transition-colors">
                  {t.animalNutrav}
                </Link>
                {t.animalNom && <span className="text-sm font-semibold text-gray-800">{t.animalNom}</span>}
              </div>

              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{t.medicamentNom}</span>
                {t.voie && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.voie}</span>}
                {t.dose != null && (
                  <span className="text-xs text-gray-500">{t.dose} {t.uniteDosage ?? "ml"}</span>
                )}
              </div>

              {t.motif && <div className="text-xs text-gray-500 mt-1">Motif : {t.motif}</div>}

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {t.enCours && (
                  <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                    <Clock size={11} /> Traitement jusqu&apos;au {formatDate(new Date(t.dateFin))}
                  </span>
                )}
                {t.enAttente && t.joursRestantsAttente != null && t.joursRestantsAttente > 0 && (
                  <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-full font-medium">
                    <AlertTriangle size={11} /> Attente viande : {t.joursRestantsAttente}j restants
                  </span>
                )}
              </div>

              {t.veterinaire && <div className="text-xs text-gray-400 mt-1">Vét. : {t.veterinaire}</div>}
            </div>

            {t.statut === "EN_COURS" && (
              <button onClick={() => terminer(t.id)}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                <CheckCircle2 size={13} /> Terminer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoriqueTab({ traitements }: { traitements: TraitementItem[] }) {
  const termines = traitements.filter((t) => !t.enCours && !t.enAttente);

  if (termines.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <History size={32} className="mx-auto mb-2" />
        <div className="text-sm">Aucun traitement terminé</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {termines.map((t) => (
        <div key={t.id} className="bg-white rounded-xl shadow border p-3 opacity-75">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/troupeau/${t.animalNutrav}`}
              className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100">
              {t.animalNutrav}
            </Link>
            {t.animalNom && <span className="text-sm font-medium text-gray-700">{t.animalNom}</span>}
            <span className="text-sm text-gray-600">{t.medicamentNom}</span>
            <span className="ml-auto text-xs text-gray-400">{formatDate(new Date(t.dateDebut))}</span>
          </div>
          {t.motif && <div className="text-xs text-gray-400 mt-0.5">{t.motif}</div>}
        </div>
      ))}
    </div>
  );
}

export default function TraitementsTab({ traitements }: { traitements: TraitementItem[] }) {
  const [onglet, setOnglet] = useState<"encours" | "historique">("encours");
  const [, forceRefresh] = useState(0);

  const enCoursCount = traitements.filter((t) => t.enCours || t.enAttente).length;
  const attenteCount = traitements.filter((t) => t.enAttente && t.joursRestantsAttente && t.joursRestantsAttente > 0).length;

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {([
          ["encours", "En cours", enCoursCount, attenteCount > 0],
          ["historique", "Historique", traitements.filter((t) => !t.enCours && !t.enAttente).length, false],
        ] as const).map(([id, label, count, alert]) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              onglet === id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                alert ? "bg-orange-500 text-white" : onglet === id ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {onglet === "encours" && <EnCoursTab traitements={traitements} onRefresh={() => forceRefresh((n) => n + 1)} />}
      {onglet === "historique" && <HistoriqueTab traitements={traitements} />}
    </div>
  );
}
