"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";

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
}

const today = new Date().toISOString().slice(0, 10);

export default function TraitementForm({ animalId, onClose }: Props) {
  const router = useRouter();
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/medicaments")
      .then((r) => r.json())
      .then((data: Medicament[]) => setMedicaments(data.filter((m) => (m as unknown as { actif: boolean }).actif)));
  }, []);

  const selectedMed = medicaments.find((m) => m.id === medicamentId);

  function onMedChange(id: string) {
    setMedicamentId(id);
    const med = medicaments.find((m) => m.id === id);
    if (med) {
      setVoie(med.voie ?? "");
      setUniteDosage(med.uniteDosage ?? "ml");
    }
  }

  const effectiveNom = medicamentId
    ? (selectedMed?.nom ?? "")
    : medicamentNomLibre;

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
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

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

      <div>
        <label className="text-xs text-gray-500 block mb-1">Vétérinaire</label>
        <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nom du vétérinaire" />
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
