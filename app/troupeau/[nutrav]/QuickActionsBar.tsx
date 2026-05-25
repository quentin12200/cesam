"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Thermometer, Syringe, Stethoscope, X } from "lucide-react";

interface Taureau {
  id: string;
  nupere: string;
  nopere: string | null;
}

interface Props {
  animalId: string;
  isFemelle: boolean;
  isActif: boolean;
}

type Modal = "chaleur" | "saillie" | "traitement" | null;

const today = new Date().toISOString().slice(0, 10);

const TRAITEMENT_TYPES = [
  "Antibiotique",
  "Anti-inflammatoire",
  "Antiparasitaire",
  "Vitamines / Oligo-éléments",
  "Bolus",
  "Vaccination",
  "Autre",
];

export default function QuickActionsBar({ animalId, isFemelle, isActif }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(false);
  const [taureaux, setTaureaux] = useState<Taureau[]>([]);

  // Chaleur state
  const [chaleurDate, setChaleurDate] = useState(today);
  const [chaleurNotes, setChaleurNotes] = useState("");

  // Saillie state
  const [saillieDate, setSaillieDate] = useState(today);
  const [saillieType, setSaillieType] = useState<"IA" | "Naturelle">("IA");
  const [saillieTabId, setSaillieTabId] = useState("");

  // Traitement state
  const [traitDate, setTraitDate] = useState(today);
  const [traitType, setTraitType] = useState(TRAITEMENT_TYPES[0]);
  const [traitDesc, setTraitDesc] = useState("");

  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal === "saillie" && taureaux.length === 0) {
      fetch("/api/taureaux")
        .then((r) => r.json())
        .then((d) => setTaureaux(d.taureaux ?? []));
    }
  }, [modal, taureaux.length]);

  function open(m: Modal) {
    setChaleurDate(today);
    setChaleurNotes("");
    setSaillieDate(today);
    setSaillieType("IA");
    setSaillieTabId("");
    setTraitDate(today);
    setTraitType(TRAITEMENT_TYPES[0]);
    setTraitDesc("");
    setModal(m);
  }

  function close() {
    setModal(null);
  }

  async function submitChaleur() {
    setLoading(true);
    try {
      const res = await fetch("/api/chaleurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId, date: chaleurDate, notes: chaleurNotes || null }),
      });
      if (!res.ok) throw new Error("Erreur");
      close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function submitSaillie() {
    setLoading(true);
    try {
      const res = await fetch("/api/saillies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId,
          date: saillieDate,
          type: saillieType,
          taureauId: saillieTabId || null,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function submitTraitement() {
    setLoading(true);
    try {
      const res = await fetch("/api/evenements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId, type: traitType, date: traitDate, description: traitDesc || null }),
      });
      if (!res.ok) throw new Error("Erreur");
      close();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Action buttons row */}
      <div className="flex gap-2 px-4 pt-3 pb-1 flex-wrap">
        {isFemelle && isActif && (
          <button
            onClick={() => open("chaleur")}
            className="flex items-center gap-1.5 px-3 py-2 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-100 active:scale-95 transition-all"
          >
            <Thermometer size={15} />
            Chaleur
          </button>
        )}
        {isFemelle && isActif && (
          <button
            onClick={() => open("saillie")}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 active:scale-95 transition-all"
          >
            <Syringe size={15} />
            Saillie / IA
          </button>
        )}
        {isActif && (
          <button
            onClick={() => open("traitement")}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
          >
            <Stethoscope size={15} />
            Traitement
          </button>
        )}
      </div>

      {/* Modal backdrop */}
      {modal && (
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === backdropRef.current) close(); }}
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            {/* ── Chaleur ── */}
            {modal === "chaleur" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Thermometer size={18} className="text-pink-500" />
                    Chaleur observée
                  </h3>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={chaleurDate}
                      max={today}
                      onChange={(e) => setChaleurDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optionnel)</label>
                    <input
                      type="text"
                      value={chaleurNotes}
                      onChange={(e) => setChaleurNotes(e.target.value)}
                      placeholder="Observation..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                  </div>
                  <button
                    onClick={submitChaleur}
                    disabled={!chaleurDate || loading}
                    className="w-full py-2.5 bg-pink-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 active:scale-98 transition-all"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer la chaleur"}
                  </button>
                </div>
              </>
            )}

            {/* ── Saillie ── */}
            {modal === "saillie" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Syringe size={18} className="text-green-600" />
                    Saillie / IA
                  </h3>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={saillieDate}
                      max={today}
                      onChange={(e) => setSaillieDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <div className="flex gap-2">
                      {(["IA", "Naturelle"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSaillieType(t)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            saillieType === t
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-green-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Taureau (optionnel)</label>
                    <select
                      value={saillieTabId}
                      onChange={(e) => setSaillieTabId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">— Non précisé —</option>
                      {taureaux.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nopere ?? t.nupere}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={submitSaillie}
                    disabled={!saillieDate || loading}
                    className="w-full py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 active:scale-98 transition-all"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer la saillie"}
                  </button>
                </div>
              </>
            )}

            {/* ── Traitement ── */}
            {modal === "traitement" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Stethoscope size={18} className="text-blue-600" />
                    Traitement sanitaire
                  </h3>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select
                      value={traitType}
                      onChange={(e) => setTraitType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    >
                      {TRAITEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={traitDate}
                      max={today}
                      onChange={(e) => setTraitDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description (optionnel)</label>
                    <textarea
                      value={traitDesc}
                      onChange={(e) => setTraitDesc(e.target.value)}
                      rows={2}
                      placeholder="Produit, dose, remarques..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={submitTraitement}
                    disabled={!traitDate || !traitType || loading}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 active:scale-98 transition-all"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer le traitement"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
