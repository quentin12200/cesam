"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Wifi, X } from "lucide-react";

interface Capteur {
  id: string;
  numero: number;
  animalNutrav: string | null;
  animalNom: string | null;
  dateAttribution: string | null;
  actif: boolean;
}

export default function CapteurManager({ capteurs: initial }: { capteurs: Capteur[] }) {
  const [capteurs, setCapteurs] = useState(initial);
  const [gestionOuverte, setGestionOuverte] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [nutravInput, setNutravInput] = useState("");
  const [nomInput, setNomInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAttribuer(id: string) {
    if (!nutravInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/capteurs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attribuer", nutrav: nutravInput.trim(), nom: nomInput.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCapteurs((current) =>
          current.map((capteur) =>
            capteur.id === id ? { ...updated, dateAttribution: updated.dateAttribution ?? null } : capteur
          )
        );
        setAssigningId(null);
        setNutravInput("");
        setNomInput("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLiberer(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/capteurs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "liberer" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCapteurs((current) =>
          current.map((capteur) =>
            capteur.id === id ? { ...updated, dateAttribution: null } : capteur
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function annulerAttribution() {
    setAssigningId(null);
    setNutravInput("");
    setNomInput("");
  }

  const capteursActifs = capteurs.filter((capteur) => capteur.actif);
  const capteursDisponibles = capteurs.filter((capteur) => !capteur.actif);

  return (
    <section className="bg-white rounded-xl shadow overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Wifi size={16} className="text-green-700" />
        <h3 className="font-semibold text-gray-800">Capteurs vêlage</h3>
        <span className="ml-auto text-xs text-gray-500">
          {capteursActifs.length} actif{capteursActifs.length > 1 ? "s" : ""} · {capteursDisponibles.length} disponible{capteursDisponibles.length > 1 ? "s" : ""}
        </span>
      </div>

      {capteursActifs.length > 0 && (
        <>
          <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-orange-700">
            <AlertTriangle size={14} className="shrink-0" />
            Retirer le capteur après le vêlage
          </div>
          <div className="border-t border-gray-100 divide-y divide-gray-100">
            {capteursActifs.map((capteur) => (
              <div key={capteur.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-gray-800">Capteur {capteur.numero}</span>
                    <span className="text-sm text-green-800 truncate">
                      {capteur.animalNutrav ?? "Animal inconnu"}
                      {capteur.animalNom ? ` · ${capteur.animalNom}` : ""}
                    </span>
                  </div>
                  {capteur.dateAttribution && (
                    <p className="text-xs text-gray-400">
                      Posé le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleLiberer(capteur.id)}
                  disabled={loading}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  title="Retirer le capteur"
                  aria-label={`Retirer le capteur ${capteur.numero}`}
                >
                  <X size={17} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setGestionOuverte((value) => !value)}
        className="w-full flex items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-2.5 text-xs font-medium text-green-700 hover:bg-green-50"
        aria-expanded={gestionOuverte}
      >
        Gérer les capteurs
        {gestionOuverte ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {gestionOuverte && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {capteursDisponibles.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">Aucun capteur disponible.</p>
          ) : (
            capteursDisponibles.map((capteur) => (
              <div key={capteur.id} className="px-4 py-2.5">
                {assigningId === capteur.id ? (
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={nutravInput}
                      onChange={(event) => setNutravInput(event.target.value)}
                      placeholder="N° travail *"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                      autoFocus
                    />
                    <input
                      value={nomInput}
                      onChange={(event) => setNomInput(event.target.value)}
                      placeholder="Nom (optionnel)"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleAttribuer(capteur.id)}
                        disabled={loading || !nutravInput.trim()}
                        className="px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={annulerAttribution}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Annuler"
                        aria-label="Annuler l’attribution"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Capteur {capteur.numero}</span>
                    <span className="text-xs text-gray-400">Disponible</span>
                    <button
                      type="button"
                      onClick={() => setAssigningId(capteur.id)}
                      className="ml-auto p-2 text-green-700 hover:bg-green-50 rounded-lg"
                      title="Attribuer le capteur"
                      aria-label={`Attribuer le capteur ${capteur.numero}`}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
