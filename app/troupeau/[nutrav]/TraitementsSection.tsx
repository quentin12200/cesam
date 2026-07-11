"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pill, Plus, Clock, CheckCircle2, AlertTriangle, ScanLine, Loader2 } from "lucide-react";
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
  delaiAttenteLaitJ: number | null;
  ordonnanceNumero: string | null;
}

interface ScanResult {
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  dureeJours: number | null;
  dateDebut: string | null;
  veterinaire: string | null;
  motif: string | null;
  ordonnanceNumero: string | null;
}

interface Props {
  animalId: string;
  traitements: TraitementRow[];
}

export default function TraitementsSection({ animalId, traitements }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanResult | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const now = new Date();

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || "image/jpeg";
      const res = await fetch("/api/scan-ordonnance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur serveur");
      }
      const result: ScanResult = await res.json();
      setPendingScan(result);
      setShowForm(true);
    } finally {
      setScanning(false);
    }
  }

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            title="Scanner une ordonnance (photo ou PDF)"
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
            {scanning ? "Scan..." : "Scanner"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFilePick} />
          <button onClick={() => { setShowForm((v) => !v); setPendingScan(undefined); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={13} /> Nouveau
          </button>
        </div>
      </div>

      {showForm && <TraitementForm animalId={animalId} onClose={() => { setShowForm(false); setPendingScan(undefined); }} initialScan={pendingScan} />}

      {traitements.length === 0 && !showForm ? (
        <div className="text-center py-6 text-gray-400 text-sm">Aucun traitement enregistré</div>
      ) : (
        <div className="space-y-2 mt-2">
          {traitements.map((t) => {
            const dateDebut = new Date(t.dateDebut);
            const dateFin = addDays(dateDebut, t.dureeJours);
            const enCours = now < dateFin && t.statut === "EN_COURS";
            const dateFinAttenteViande = t.delaiAttenteViandeJ != null ? addDays(dateFin, t.delaiAttenteViandeJ + 1) : null;
            const dateFinAttenteLait = t.delaiAttenteLaitJ != null ? addDays(dateFin, t.delaiAttenteLaitJ) : null;
            const dateFinAttente = dateFinAttenteViande;
            const enAttente = dateFinAttente ? now < dateFinAttente : false;
            const enAttenteLait = dateFinAttenteLait ? now < dateFinAttenteLait : false;

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
                      {t.ordonnanceNumero && <span>N° ordonnance : {t.ordonnanceNumero}</span>}
                      {enCours && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Clock size={10} /> jusqu&apos;au {formatDate(dateFin)}
                        </span>
                      )}
                      {enAttente && dateFinAttenteViande && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <AlertTriangle size={10} /> Attente viande jusqu&apos;au {formatDate(dateFinAttenteViande)}
                        </span>
                      )}
                      {enAttenteLait && dateFinAttenteLait && (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          <AlertTriangle size={10} /> Attente lait jusqu&apos;au {formatDate(dateFinAttenteLait)}
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
