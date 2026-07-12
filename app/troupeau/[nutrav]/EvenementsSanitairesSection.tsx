"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getCategorieLabel } from "@/lib/evenements-sanitaires";

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
  symptomes: { libelle: string }[];
}

export default function EvenementsSanitairesSection({ evenements }: { evenements: EvenementRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  if (evenements.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-red-500" />
        Événements sanitaires ({evenements.length})
      </h3>
      <div className="space-y-2">
        {evenements.map((evt) => (
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
                  {evt.temperature != null && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full">
                      {evt.temperature}°C
                    </span>
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
            <button
              onClick={() => toggleResolu(evt)}
              disabled={loadingId === evt.id}
              className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <CheckCircle2 size={12} />
              {evt.resolu ? "Marquer non résolu" : "Marquer résolu"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
