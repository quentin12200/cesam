"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, X, ScanLine, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Medicament {
  id: string;
  nom: string;
  dci: string | null;
  voie: string | null;
  dosagePourKg: number | null;
  uniteDosage: string | null;
  delaiAttenteViandeJ: number | null;
}

interface Props {
  animalId: string;
  onClose: () => void;
  initialScan?: ScanResult;
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

const today = new Date().toISOString().slice(0, 10);

export default function TraitementForm({ animalId, onClose, initialScan }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [medicamentId, setMedicamentId] = useState("");
  const [medicamentNomLibre, setMedicamentNomLibre] = useState("");
  const [dateDebut, setDateDebut] = useState(today);
  const [dureeJours, setDureeJours] = useState("3");
  const [voie, setVoie] = useState("");
  const [dose, setDose] = useState("");
  const [uniteDosage, setUniteDosage] = useState("ml");
  const [motif, setMotif] = useState("");
  const [veterinaire, setVeterinaire] = useState("");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState("");
  const [saving, setSaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "ok" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");

  useEffect(() => {
    fetch("/api/medicaments")
      .then((r) => r.json())
      .then((data: Medicament[]) => {
        const active = data.filter((m) => (m as unknown as { actif: boolean }).actif);
        setMedicaments(active);
        if (initialScan) {
          applyScannedWithMeds(active, initialScan);
          setScanStatus("ok");
          setScanMsg("Ordonnance analysée — vérifiez les champs ci-dessous");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMed = medicaments.find((m) => m.id === medicamentId);

  function applyScannedWithMeds(meds: Medicament[], result: ScanResult) {
    if (result.medicamentNom) {
      const match = meds.find(
        (m) =>
          m.nom.toLowerCase().includes(result.medicamentNom!.toLowerCase()) ||
          result.medicamentNom!.toLowerCase().includes(m.nom.toLowerCase())
      );
      if (match) {
        setMedicamentId(match.id);
        setVoie(match.voie ?? "");
        setUniteDosage(match.uniteDosage ?? "ml");
      } else {
        setMedicamentId("");
        setMedicamentNomLibre(result.medicamentNom);
      }
    }
    if (result.voie) setVoie(result.voie);
    if (result.dose != null) setDose(String(result.dose));
    if (result.uniteDosage) setUniteDosage(result.uniteDosage);
    if (result.dureeJours != null) setDureeJours(String(result.dureeJours));
    if (result.dateDebut) setDateDebut(result.dateDebut);
    if (result.veterinaire) setVeterinaire(result.veterinaire);
    if (result.motif) setMotif(result.motif);
    if (result.ordonnanceNumero) setOrdonnanceNumero(result.ordonnanceNumero);
  }

  function onMedChange(id: string) {
    setMedicamentId(id);
    const med = medicaments.find((m) => m.id === id);
    if (med) {
      setVoie(med.voie ?? "");
      setUniteDosage(med.uniteDosage ?? "ml");
    }
  }

  const effectiveNom = medicamentId ? (selectedMed?.nom ?? "") : medicamentNomLibre;

  function applyScanned(result: ScanResult) {
    if (result.medicamentNom) {
      // Try to match existing medicament
      const match = medicaments.find(
        (m) =>
          m.nom.toLowerCase().includes(result.medicamentNom!.toLowerCase()) ||
          result.medicamentNom!.toLowerCase().includes(m.nom.toLowerCase())
      );
      if (match) {
        onMedChange(match.id);
      } else {
        setMedicamentId("");
        setMedicamentNomLibre(result.medicamentNom);
      }
    }
    if (result.voie) setVoie(result.voie);
    if (result.dose != null) setDose(String(result.dose));
    if (result.uniteDosage) setUniteDosage(result.uniteDosage);
    if (result.dureeJours != null) setDureeJours(String(result.dureeJours));
    if (result.dateDebut) setDateDebut(result.dateDebut);
    if (result.veterinaire) setVeterinaire(result.veterinaire);
    if (result.motif) setMotif(result.motif);
    if (result.ordonnanceNumero) setOrdonnanceNumero(result.ordonnanceNumero);
  }

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
      applyScanned(result);
      setScanStatus("ok");
      setScanMsg("Ordonnance analysée — vérifiez les champs ci-dessous");
    } catch (err) {
      setScanStatus("error");
      setScanMsg(err instanceof Error ? err.message : "Erreur lors du scan");
    } finally {
      setScanning(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveNom.trim()) return;
    setSaving(true);
    await fetch("/api/traitements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalId,
        medicamentId: medicamentId || null,
        medicamentNom: effectiveNom,
        dateDebut,
        dureeJours: Number(dureeJours) || 1,
        voie: voie || null,
        dose: dose !== "" ? Number(dose) : null,
        uniteDosage: uniteDosage || null,
        motif: motif || null,
        veterinaire: veterinaire || null,
        ordonnanceNumero: ordonnanceNumero || null,
      }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-800">Nouveau traitement</span>
        <div className="flex items-center gap-2">
          {/* Scanner button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            title="Scanner une ordonnance (photo ou PDF)"
          >
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
            {scanning ? "Analyse..." : "Scanner ordonnance"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFilePick}
          />
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scan status banner */}
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

      <div>
        <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
        <select value={medicamentId} onChange={(e) => onMedChange(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">— Saisie libre —</option>
          {medicaments.map((m) => (
            <option key={m.id} value={m.id}>{m.nom}{m.dci ? ` (${m.dci})` : ""}</option>
          ))}
        </select>
        {!medicamentId && (
          <input className="mt-1.5 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Nom du médicament" value={medicamentNomLibre}
            onChange={(e) => setMedicamentNomLibre(e.target.value)} />
        )}
      </div>

      {selectedMed?.delaiAttenteViandeJ != null && selectedMed.delaiAttenteViandeJ > 0 && (
        <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-700">
          ⚠ Délai d&apos;attente viande : {selectedMed.delaiAttenteViandeJ} jours après la fin du traitement
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Date début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
          <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Voie</label>
          <input value={voie} onChange={(e) => setVoie(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="IM/SC..." />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Dose</label>
          <input type="number" min={0} step="0.1" value={dose} onChange={(e) => setDose(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Unité</label>
          <input value={uniteDosage} onChange={(e) => setUniteDosage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ml" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Motif</label>
        <input value={motif} onChange={(e) => setMotif(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Pneumonie, diarrhée..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Vétérinaire</label>
          <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nom du vétérinaire" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">N° ordonnance</label>
          <input value={ordonnanceNumero} onChange={(e) => setOrdonnanceNumero(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: O97734" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !effectiveNom.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save size={14} /> Enregistrer
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
