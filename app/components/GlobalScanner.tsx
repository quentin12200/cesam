"use client";

import { useState, useRef } from "react";
import { ScanLine, Loader2, X, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface ScanResult {
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  dureeJours: number | null;
  dateDebut: string | null;
  veterinaire: string | null;
  motif: string | null;
}

interface AnimalResult {
  id: string;
  nutrav: string;
  nom: string | null;
}

const today = new Date().toISOString().slice(0, 10);

export default function GlobalScanner() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "ok" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");

  const [animalSearch, setAnimalSearch] = useState("");
  const [animalResults, setAnimalResults] = useState<AnimalResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");

  const [medicamentNom, setMedicamentNom] = useState("");
  const [voie, setVoie] = useState("");
  const [dose, setDose] = useState("");
  const [uniteDosage, setUniteDosage] = useState("ml");
  const [dureeJours, setDureeJours] = useState("3");
  const [dateDebut, setDateDebut] = useState(today);
  const [veterinaire, setVeterinaire] = useState("");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setScanning(true);
    setScanStatus("idle");
    setScanMsg("");

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
      if (result.medicamentNom) setMedicamentNom(result.medicamentNom);
      if (result.voie) setVoie(result.voie);
      if (result.dose != null) setDose(String(result.dose));
      if (result.uniteDosage) setUniteDosage(result.uniteDosage);
      if (result.dureeJours != null) setDureeJours(String(result.dureeJours));
      if (result.dateDebut) setDateDebut(result.dateDebut);
      if (result.veterinaire) setVeterinaire(result.veterinaire);
      if (result.motif) setMotif(result.motif);
      setScanStatus("ok");
      setScanMsg("Ordonnance analysée — sélectionnez l'animal et vérifiez les champs");
    } catch (err) {
      setScanStatus("error");
      setScanMsg(err instanceof Error ? err.message : "Erreur lors du scan");
    } finally {
      setScanning(false);
      setShowModal(true);
    }
  }

  async function searchAnimals(q: string) {
    setAnimalSearch(q);
    if (q.length < 1) { setAnimalResults([]); setShowDropdown(false); return; }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data: AnimalResult[] = await res.json();
    setAnimalResults(data);
    setShowDropdown(true);
  }

  function selectAnimal(a: AnimalResult) {
    setSelectedAnimalId(a.id);
    setAnimalSearch(`${a.nutrav}${a.nom ? ` — ${a.nom}` : ""}`);
    setShowDropdown(false);
  }

  async function handleSubmit() {
    if (!selectedAnimalId || !medicamentNom.trim()) return;
    setSaving(true);
    await fetch("/api/traitements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId: selectedAnimalId,
        medicamentId: null,
        medicamentNom,
        dateDebut,
        dureeJours: Number(dureeJours) || 1,
        voie: voie || null,
        dose: dose !== "" ? Number(dose) : null,
        uniteDosage: uniteDosage || null,
        motif: motif || null,
        veterinaire: veterinaire || null,
      }),
    });
    setSaving(false);
    closeModal();
    router.refresh();
  }

  function closeModal() {
    setShowModal(false);
    setSelectedAnimalId("");
    setAnimalSearch("");
    setAnimalResults([]);
    setMedicamentNom("");
    setVoie("");
    setDose("");
    setUniteDosage("ml");
    setDureeJours("3");
    setDateDebut(today);
    setVeterinaire("");
    setMotif("");
    setScanStatus("idle");
    setScanMsg("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="p-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors"
        title="Scanner une ordonnance"
      >
        {scanning ? <Loader2 size={20} className="animate-spin" /> : <ScanLine size={20} />}
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFilePick} />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white text-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white text-gray-800">
              <span className="font-semibold text-gray-800 flex items-center gap-2">
                <ScanLine size={16} className="text-blue-500" />
                Ordonnance scannée
              </span>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {scanStatus !== "idle" && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                  scanStatus === "ok"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {scanStatus === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {scanMsg}
                </div>
              )}

              <div className="relative">
                <label className="text-xs text-gray-500 block mb-1">Animal *</label>
                <input
                  value={animalSearch}
                  onChange={(e) => searchAnimals(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
                  placeholder="N° nutrav ou nom"
                />
                {showDropdown && animalResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10">
                    {animalResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={() => selectAnimal(a)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                      >
                        {a.nutrav}{a.nom ? ` — ${a.nom}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
                <input value={medicamentNom} onChange={(e) => setMedicamentNom(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" placeholder="Nom du médicament" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Dose</label>
                  <div className="flex gap-1">
                    <input value={dose} onChange={(e) => setDose(e.target.value)} type="number" step="0.1"
                      className="w-full border rounded-lg px-2 py-2 text-sm bg-white text-gray-800" placeholder="0" />
                    <select value={uniteDosage} onChange={(e) => setUniteDosage(e.target.value)}
                      className="border rounded-lg px-1 py-2 text-sm bg-white text-gray-800">
                      <option>ml</option><option>mg</option><option>UI</option><option>cp</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Voie</label>
                  <input value={voie} onChange={(e) => setVoie(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" placeholder="IV, SC..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Début</label>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
                  <input type="number" value={dureeJours} onChange={(e) => setDureeJours(e.target.value)} min="1"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Vétérinaire</label>
                <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" placeholder="Nom du vétérinaire" />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Motif</label>
                <input value={motif} onChange={(e) => setMotif(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-gray-800" placeholder="Motif du traitement" />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || !selectedAnimalId || !medicamentNom.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button type="button" onClick={closeModal}
                  className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
