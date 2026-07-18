"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Plus } from "lucide-react";
import { getMomentActuel } from "@/lib/evenements-sanitaires";

const COMPLICATIONS = [
  "Non-délivrance",
  "Rétention placentaire",
  "Retournement de matrice",
  "Prolapsus vaginal",
];

type QualificatifPrincipal = "NORMAL" | "DIFFICILE" | "AVORTEMENT" | "MORT_NEE" | "JUMEAUX";

const QUALIFICATIFS_PRINCIPAUX: { value: QualificatifPrincipal; label: string; color: string }[] = [
  { value: "NORMAL", label: "Normal", color: "bg-green-500 text-white border-green-500" },
  { value: "DIFFICILE", label: "Difficile", color: "bg-orange-400 text-white border-orange-400" },
  { value: "AVORTEMENT", label: "Avortement", color: "bg-red-500 text-white border-red-500" },
  { value: "MORT_NEE", label: "Mort-né", color: "bg-gray-600 text-white border-gray-600" },
  { value: "JUMEAUX", label: "Jumeaux", color: "bg-purple-500 text-white border-purple-500" },
];

const SOUS_TYPES: Record<QualificatifPrincipal, { value: string; label: string }[]> = {
  NORMAL: [
    { value: "SEULE", label: "Seule" },
    { value: "ASSISTEE", label: "Assistée" },
  ],
  DIFFICILE: [
    { value: "MAUVAIS_POSITIONNEMENT", label: "Mauvais positionnement" },
    { value: "GROS_VEAU", label: "Gros veau" },
    { value: "VACHE_NON_PREPAREE", label: "Vache non préparée" },
    { value: "CESARIENNE", label: "Césarienne" },
  ],
  AVORTEMENT: [],
  MORT_NEE: [],
  JUMEAUX: [
    { value: "DEUX_VIVANTS", label: "2 vivants" },
    { value: "UN_MORT", label: "1 vivant / 1 mort" },
    { value: "DEUX_MORTS", label: "2 morts" },
  ],
};

interface Props {
  initialOpen?: boolean;
  initialMere?: string;
  initialDate?: string;
  initialMoment?: "Matin" | "Soir" | "";
  initialSexe?: "M" | "F" | "";
}

export default function VelageFormWrapper({ initialOpen = false, initialMere = "", initialDate, initialMoment = "", initialSexe = "" }: Props) {
  const [showForm, setShowForm] = useState(initialOpen);
  const [vacheNutrav, setVacheNutrav] = useState(initialMere);
  const [vacheInfo, setVacheInfo] = useState<{ nobovi: string | null } | null>(null);
  const [veauNutrav, setVeauNutrav] = useState("");
  const [veauSexe, setVeauSexe] = useState<"M" | "F" | "">(initialSexe);
  const [veauNom, setVeauNom] = useState("");
  const [date, setDate] = useState(initialDate === undefined ? new Date().toISOString().split("T")[0] : initialDate);
  const [moment, setMoment] = useState<"Matin" | "Soir" | "">(initialMoment);
  const [qualificatif, setQualificatif] = useState<QualificatifPrincipal>("NORMAL");
  const [sousType, setSousType] = useState<string>("");
  const [capteur, setCapteur] = useState<string>("");
  const [pereNom, setPereNom] = useState("");
  const [pereAutoFilled, setPereAutoFilled] = useState(false);
  const [complications, setComplications] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const vacheDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQualificatifChange(q: QualificatifPrincipal) {
    setQualificatif(q);
    setSousType("");
  }

  function toggleComplication(c: string) {
    setComplications((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }

  const fetchVacheInfo = useCallback(async (nutrav: string) => {
    if (nutrav.length < 3) { setVacheInfo(null); return; }
    try {
      const res = await fetch(`/api/animaux/${nutrav}`);
      if (!res.ok) { setVacheInfo(null); return; }
      const data = await res.json();
      setVacheInfo({ nobovi: data.nobovi });
      // Auto-remplir le père depuis la dernière saillie
      if (!pereAutoFilled || !pereNom) {
        const saillies: { date: string; taureau?: { nopere?: string; nupere?: string } | null; pereNom?: string | null }[] = data.saillies ?? [];
        if (saillies.length > 0) {
          const last = saillies[0];
          const nom = last.taureau?.nopere ?? last.pereNom ?? "";
          if (nom) { setPereNom(nom); setPereAutoFilled(true); }
        }
      }
    } catch {}
  }, [pereAutoFilled, pereNom]);

  useEffect(() => {
    if (initialOpen && initialMere) void fetchVacheInfo(initialMere);
  }, [fetchVacheInfo, initialMere, initialOpen]);

  function handleVacheChange(val: string) {
    setVacheNutrav(val.toUpperCase());
    setVacheInfo(null);
    if (vacheDebounce.current) clearTimeout(vacheDebounce.current);
    vacheDebounce.current = setTimeout(() => fetchVacheInfo(val.toUpperCase()), 500);
  }

  function resetForm() {
    setVacheNutrav(""); setVacheInfo(null);
    setVeauNutrav(""); setVeauSexe(""); setVeauNom("");
    setQualificatif("NORMAL"); setSousType("");
    setPereNom(""); setPereAutoFilled(false);
    setComplications(new Set());
    setCapteur("");
    setDate(new Date().toISOString().split("T")[0]);
    setMoment("");
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/velages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacheNutrav,
          veauNutrav: veauNutrav || undefined,
          veauSexe: veauSexe || undefined,
          veauNom: veauNom || undefined,
          date,
          moment: moment || undefined,
          qualificatif,
          sousType: sousType || undefined,
          capteur: capteur ? parseInt(capteur, 10) : undefined,
          pereNom: pereNom || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur");
      }
      const data = await res.json();

      const typesASignaler = new Set(complications);
      if (sousType === "CESARIENNE") typesASignaler.add("Césarienne");
      if (typesASignaler.size > 0 && data.vacheId) {
        await Promise.all(
          Array.from(typesASignaler).map((type) =>
            fetch("/api/evenements/batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                animalIds: [data.vacheId],
                date,
                moment: getMomentActuel(),
                categorie: "INTERVENTION",
                type,
                description: `Suite au vélage du ${new Date(date).toLocaleDateString("fr-FR")}`,
              }),
            }).catch(() => {})
          )
        );
      }

      const txt = data._veauCree
        ? `Vélage enregistré ! Veau ${data._veauCree} créé dans le troupeau — pense à ajouter son N° national.`
        : "Vélage enregistré !";
      setMessage({ text: txt, ok: true });
      setShowForm(false);
      resetForm();
    } catch (err) {
      setMessage({ text: String(err).replace("Error: ", ""), ok: false });
    } finally {
      setSaving(false);
    }
  }

  const sousCats = SOUS_TYPES[qualificatif];

  return (
    <>
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center justify-between border
          ${message.ok
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="font-bold ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-4 rounded-xl font-medium text-base"
      >
        <Plus size={20} /> Enregistrer un vélage
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Enregistrer un vélage</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 text-2xl leading-none px-2">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Message d'erreur visible dans le formulaire */}
              {message && !message.ok && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-start justify-between gap-2">
                  <span>{message.text}</span>
                  <button type="button" onClick={() => setMessage(null)} className="text-red-400 font-bold shrink-0">×</button>
                </div>
              )}

              {/* Vache */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NUTRAV de la vache</label>
                <input
                  type="text"
                  value={vacheNutrav}
                  onChange={(e) => handleVacheChange(e.target.value)}
                  placeholder="ex: 0042"
                  required
                  className="w-full border border-gray-200 rounded-lg p-3 text-base font-mono"
                />
                {vacheInfo?.nobovi && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">{vacheInfo.nobovi}</p>
                )}
              </div>

              {/* Veau : nutrav + sexe + nom sur la même section */}
              <div className="bg-sky-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-sky-800">Informations du veau</p>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NUTRAV du veau (optionnel)</label>
                  <input
                    type="text"
                    value={veauNutrav}
                    onChange={(e) => setVeauNutrav(e.target.value.toUpperCase())}
                    placeholder="ex: 0166"
                    className="w-full border border-gray-200 rounded-lg p-3 text-base font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Sexe</label>
                  <div className="flex gap-2">
                    {(["M", "F"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setVeauSexe(veauSexe === s ? "" : s)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors
                          ${veauSexe === s
                            ? s === "M" ? "bg-sky-500 text-white border-sky-500" : "bg-pink-500 text-white border-pink-500"
                            : "border-gray-200 text-gray-700 bg-white"}`}
                      >
                        {s === "M" ? "♂ Mâle" : "♀ Femelle"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom / surnom (optionnel)</label>
                  <input
                    type="text"
                    value={veauNom}
                    onChange={(e) => setVeauNom(e.target.value)}
                    placeholder="ex: BOOSTIFLOR"
                    className="w-full border border-gray-200 rounded-lg p-3 text-base bg-white"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date du vélage</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg p-3 text-base"
                />
              </div>

              {/* Moment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moment</label>
                <select value={moment} onChange={(e) => setMoment(e.target.value as "Matin" | "Soir" | "")} className="w-full border border-gray-200 rounded-lg p-3 text-base">
                  <option value="">Non précisé</option>
                  <option value="Matin">Matin</option>
                  <option value="Soir">Soir</option>
                </select>
              </div>

              {/* Qualificatif principal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Qualificatif du vélage</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {QUALIFICATIFS_PRINCIPAUX.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => handleQualificatifChange(q.value)}
                      className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        qualificatif === q.value ? q.color : "border-gray-200 text-gray-700 bg-white"
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sous-type */}
              {sousCats.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Précision</label>
                  <div className="grid grid-cols-2 gap-2">
                    {sousCats.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSousType(sousType === s.value ? "" : s.value)}
                        className={`py-2.5 rounded-lg text-sm border-2 transition-colors ${
                          sousType === s.value
                            ? "border-gray-600 bg-gray-100 text-gray-900 font-semibold"
                            : "border-gray-200 text-gray-600 bg-white"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Complications sanitaires */}
              <div className="bg-red-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-red-800 mb-2">Complications sanitaires (optionnel)</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLICATIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleComplication(c)}
                      className={`py-2.5 rounded-lg text-sm border-2 transition-colors text-left px-3 ${
                        complications.has(c)
                          ? "border-red-500 bg-red-100 text-red-800 font-semibold"
                          : "border-gray-200 text-gray-600 bg-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-red-700 mt-2">
                  Chaque complication cochée sera enregistrée comme événement sanitaire pour la vache.
                  {sousType === "CESARIENNE" && " La césarienne sera signalée automatiquement."}
                </p>
              </div>

              {/* Père */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du père
                  {pereAutoFilled && <span className="ml-2 text-xs text-emerald-500 font-normal">auto-rempli depuis la dernière saillie</span>}
                </label>
                <input
                  type="text"
                  value={pereNom}
                  onChange={(e) => { setPereNom(e.target.value); setPereAutoFilled(false); }}
                  placeholder="ex: ZEUS"
                  className="w-full border border-gray-200 rounded-lg p-3 text-base"
                />
              </div>

              {/* Capteur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capteur utilisé (optionnel)</label>
                <select
                  value={capteur}
                  onChange={(e) => setCapteur(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-base"
                >
                  <option value="">Aucun capteur</option>
                  <option value="1">Capteur 1</option>
                  <option value="2">Capteur 2</option>
                  <option value="3">Capteur 3</option>
                  <option value="4">Capteur 4</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-pink-500 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer le vélage"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
