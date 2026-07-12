"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, Pencil, Settings2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getCategorieLabel } from "@/lib/evenements-sanitaires";
import EvenementEditPanel from "./EvenementEditPanel";

export interface ReponseRow {
  id: string;
  questionId: string;
  libelleEnregistre: string;
  valeur: string;
  questionType: string;
}

export interface EvenementRow {
  id: string;
  type: string;
  categorie: string | null;
  date: Date;
  moment: string | null;
  temperature: number | null;
  description: string | null;
  photos: string | null;
  constatePar: string | null;
  resolu: boolean;
  symptomes: { id: string; libelle: string; typeEvenementId: string | null }[];
  reponses: ReponseRow[];
}

function formatValeur(r: ReponseRow): string {
  try {
    const v = JSON.parse(r.valeur);
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "boolean") return v ? "Oui" : "Non";
    return String(v);
  } catch {
    return r.valeur;
  }
}

export default function EvenementsSanitairesSection({ evenements }: { evenements: EvenementRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [detailsOuverts, setDetailsOuverts] = useState<Set<string>>(new Set());
  const [editTempId, setEditTempId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [editionOuverte, setEditionOuverte] = useState<string | null>(null);

  async function toggleResolu(evt: EvenementRow) {
    setLoadingId(evt.id);
    try {
      await fetch(`/api/evenements/${evt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolu: !evt.resolu }),
      });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  function toggleDetails(id: string) {
    setDetailsOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commencerEditionTemp(evt: EvenementRow) {
    setEditTempId(evt.id);
    setTempValue(evt.temperature != null ? String(evt.temperature) : "");
  }

  async function enregistrerTemp(id: string) {
    setLoadingId(id);
    try {
      await fetch(`/api/evenements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: tempValue !== "" ? Number(tempValue) : null }),
      });
      setEditTempId(null);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (evenements.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-red-500" />
        Événements sanitaires ({evenements.length})
      </h3>
      <div className="space-y-2">
        {evenements.map((evt) => {
          const detailsOuvert = detailsOuverts.has(evt.id);
          return (
            <div key={evt.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{evt.type}</span>
                    {evt.categorie && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {getCategorieLabel(evt.categorie)}
                      </span>
                    )}
                    {editTempId === evt.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          type="number" step="0.1" autoFocus value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") enregistrerTemp(evt.id); }}
                          className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs"
                        />
                        <button onClick={() => enregistrerTemp(evt.id)} className="text-xs text-blue-600">OK</button>
                      </span>
                    ) : (
                      <button onClick={() => commencerEditionTemp(evt)} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full hover:bg-orange-100">
                        {evt.temperature != null ? `${evt.temperature}°C` : <><Pencil size={9} /> température</>}
                      </button>
                    )}
                  </div>
                  {evt.symptomes.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {evt.symptomes.map((s) => (
                        <span key={s.libelle} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                          {s.libelle}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDate(evt.date)}{evt.moment ? ` — ${evt.moment}` : ""}
                    {evt.constatePar ? ` · Constaté par ${evt.constatePar}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                    evt.resolu ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {evt.resolu ? "Résolu" : "En cours"}
                </span>
              </div>
              {evt.description && (
                <div className="text-xs text-gray-500 mt-1">{evt.description}</div>
              )}
              {evt.photos && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={evt.photos} alt={evt.type} className="mt-2 h-20 rounded-lg border border-gray-200 object-cover" />
              )}

              {evt.reponses.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => toggleDetails(evt.id)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <ChevronDown size={12} className={`transition-transform ${detailsOuvert ? "rotate-180" : ""}`} />
                    Précisions ({evt.reponses.length})
                  </button>
                  {detailsOuvert && (
                    <div className="mt-1.5 bg-gray-50 rounded-lg p-2 space-y-1">
                      {evt.reponses.map((r) => (
                        <div key={r.id} className="text-xs text-gray-600 flex justify-between gap-2">
                          <span className="text-gray-400">{r.libelleEnregistre}</span>
                          <span className="font-medium">{formatValeur(r)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => toggleResolu(evt)}
                  disabled={loadingId === evt.id}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <CheckCircle2 size={12} />
                  {evt.resolu ? "Marquer non résolu" : "Marquer résolu"}
                </button>
                <button
                  onClick={() => setEditionOuverte((prev) => (prev === evt.id ? null : evt.id))}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Settings2 size={12} />
                  {editionOuverte === evt.id ? "Fermer" : "Modifier"}
                </button>
              </div>

              {editionOuverte === evt.id && (
                <EvenementEditPanel
                  evenementId={evt.id}
                  symptomes={evt.symptomes}
                  reponses={evt.reponses.map((r) => ({ questionId: r.questionId, valeur: r.valeur }))}
                  onClose={() => setEditionOuverte(null)}
                  onChanged={() => router.refresh()}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
