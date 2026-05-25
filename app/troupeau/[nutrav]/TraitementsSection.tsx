"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, Plus, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { addDays } from "date-fns";
import { formatDate } from "@/lib/utils";
import TraitementForm from "./TraitementForm";

interface TraitementRow {
  id: string;
  medicamentNom: string;
  dateDebut: string;
  dureeJours: number;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  motif: string | null;
  statut: string;
  delaiAttenteViandeJ: number | null;
}

interface Props {
  animalId: string;
  traitements: TraitementRow[];
}

export default function TraitementsSection({ animalId, traitements }: Props) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const now = new Date();

  async function terminer(id: string) {
    await fetch(`/api/traitements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "TERMINE" }),
    });
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Pill size={16} className="text-blue-500" />
          Traitements
          {traitements.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{traitements.length}</span>
          )}
        </h3>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
          <Plus size={13} /> Nouveau
        </button>
      </div>

      {showForm && <TraitementForm animalId={animalId} onClose={() => setShowForm(false)} />}

      {traitements.length === 0 && !showForm ? (
        <div className="text-center py-6 text-gray-400 text-sm">Aucun traitement enregistré</div>
      ) : (
        <div className="space-y-2 mt-2">
          {traitements.map((t) => {
            const dateDebut = new Date(t.dateDebut);
            const dateFin = addDays(dateDebut, t.dureeJours);
            const enCours = now < dateFin && t.statut === "EN_COURS";
            const dateFinAttente = t.delaiAttenteViandeJ != null ? addDays(dateFin, t.delaiAttenteViandeJ) : null;
            const enAttente = dateFinAttente ? now < dateFinAttente : false;

            return (
              <div key={t.id} className={`border rounded-lg p-3 text-sm ${
                enCours ? "border-blue-200 bg-blue-50" : enAttente ? "border-orange-200 bg-orange-50" : "border-gray-100"
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{t.medicamentNom}</span>
                      {t.voie && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.voie}</span>}
                      {t.dose != null && (
                        <span className="text-xs text-gray-500">{t.dose} {t.uniteDosage ?? "ml"}</span>
                      )}
                    </div>
                    {t.motif && <div className="text-xs text-gray-500 mt-0.5">{t.motif}</div>}
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                      <span>Du {formatDate(dateDebut)} — {t.dureeJours}j</span>
                      {enCours && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Clock size={10} /> jusqu&apos;au {formatDate(dateFin)}
                        </span>
                      )}
                      {enAttente && dateFinAttente && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <AlertTriangle size={10} /> Attente viande jusqu&apos;au {formatDate(dateFinAttente)}
                        </span>
                      )}
                      {!enCours && !enAttente && t.statut !== "EN_COURS" && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 size={10} /> Terminé
                        </span>
                      )}
                    </div>
                  </div>
                  {t.statut === "EN_COURS" && (
                    <button onClick={() => terminer(t.id)}
                      className="shrink-0 text-xs px-2 py-1 text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100">
                      Terminer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
