"use client";

import { useState } from "react";
import { Wifi, WifiOff, X, AlertTriangle } from "lucide-react";

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
        setCapteurs((c) => c.map((cap) => (cap.id === id ? { ...updated, dateAttribution: updated.dateAttribution ?? null } : cap)));
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
        setCapteurs((c) => c.map((cap) => (cap.id === id ? { ...updated, dateAttribution: null } : cap)));
      }
    } finally {
      setLoading(false);
    }
  }

  const capteursActifs = capteurs.filter((c) => c.actif);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Wifi size={16} className="text-green-700" />
        Capteurs vélage
        <span className="text-xs text-gray-400 ml-auto">{capteursActifs.length}/4 actifs</span>
      </h3>

      {capteursActifs.length > 0 && (
        <div className="mb-3 p-3 bg-orange-50 border border-orange-300 rounded-lg flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-600 shrink-0" />
          <p className="text-xs font-semibold text-orange-800">
            Capteur(s) posé(s) — pensez à le retirer après le vêlage
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {capteurs.map((capteur) => (
          <div
            key={capteur.id}
            className={`p-3 rounded-xl border-2 ${capteur.actif ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-gray-700 text-sm">Capteur {capteur.numero}</span>
              {capteur.actif ? (
                <Wifi size={15} className="text-green-600" />
              ) : (
                <WifiOff size={15} className="text-gray-400" />
              )}
            </div>

            {capteur.actif ? (
              <>
                <div className="text-sm font-medium text-green-800 truncate">
                  {capteur.animalNom ?? capteur.animalNutrav ?? "Animal inconnu"}
                </div>
                {capteur.animalNutrav && capteur.animalNom && (
                  <div className="text-xs text-green-600 font-mono">{capteur.animalNutrav}</div>
                )}
                {capteur.dateAttribution && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Depuis le {new Date(capteur.dateAttribution).toLocaleDateString("fr-FR")}
                  </div>
                )}
                <button
                  onClick={() => handleLiberer(capteur.id)}
                  disabled={loading}
                  className="mt-2 w-full py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                >
                  <X size={12} />
                  Retirer capteur
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-400 mb-2">Disponible</div>
                {assigningId === capteur.id ? (
                  <div className="space-y-1.5">
                    <input
                      value={nutravInput}
                      onChange={(e) => setNutravInput(e.target.value)}
                      placeholder="N° Travail *"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                      autoFocus
                    />
                    <input
                      value={nomInput}
                      onChange={(e) => setNomInput(e.target.value)}
                      placeholder="Nom (optionnel)"
                      className="w-full border rounded px-2 py-1.5 text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAttribuer(capteur.id)}
                        disabled={loading || !nutravInput.trim()}
                        className="flex-1 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={() => {
                          setAssigningId(null);
                          setNutravInput("");
                          setNomInput("");
                        }}
                        className="px-2 py-1.5 text-xs text-gray-500 border rounded hover:bg-gray-100 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAssigningId(capteur.id)}
                    className="w-full py-1.5 text-xs font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    + Attribuer
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
