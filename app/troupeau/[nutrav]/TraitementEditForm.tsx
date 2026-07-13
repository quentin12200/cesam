"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import type { TraitementRow } from "./EvenementsSection";

interface Props {
  traitement: TraitementRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function TraitementEditForm({ traitement, onClose, onSaved }: Props) {
  const [dateDebut, setDateDebut] = useState(
    new Date(traitement.dateDebut).toISOString().slice(0, 10)
  );
  const [dureeJours, setDureeJours] = useState(String(traitement.dureeJours));
  const [voie, setVoie] = useState(traitement.voie ?? "");
  const [frequence, setFrequence] = useState(traitement.frequence ?? "");
  const [dose, setDose] = useState(
    traitement.dose != null ? String(traitement.dose) : ""
  );
  const [uniteDosage, setUniteDosage] = useState(traitement.uniteDosage ?? "ml");
  const [motif, setMotif] = useState(traitement.motif ?? "");
  const [veterinaire, setVeterinaire] = useState(traitement.veterinaire ?? "");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState(
    traitement.ordonnanceNumero ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErreur("");

    try {
      const response = await fetch(`/api/traitements/${traitement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateDebut,
          dureeJours: Number(dureeJours),
          voie: voie || null,
          frequence: frequence || null,
          dose: dose !== "" ? Number(dose) : null,
          uniteDosage: uniteDosage || null,
          motif: motif || null,
          veterinaire: veterinaire || null,
          ordonnanceNumero: ordonnanceNumero || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "La modification a échoué");
      }

      onSaved();
      onClose();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "La modification a échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={enregistrer}
      className="mt-3 border-t border-blue-100 pt-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-800">
          Modifier {traitement.medicamentNom}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Fermer"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Date de début</span>
          <input
            type="date"
            value={dateDebut}
            onChange={(event) => setDateDebut(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Durée (jours)</span>
          <input
            type="number"
            min={1}
            value={dureeJours}
            onChange={(event) => setDureeJours(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Voie</span>
          <input
            value={voie}
            onChange={(event) => setVoie(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Fréquence</span>
          <input
            value={frequence}
            onChange={(event) => setFrequence(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Quantité</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={dose}
            onChange={(event) => setDose(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Unité</span>
          <input
            value={uniteDosage}
            onChange={(event) => setUniteDosage(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-gray-500 block mb-1">Motif</span>
        <input
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">Vétérinaire</span>
          <input
            value={veterinaire}
            onChange={(event) => setVeterinaire(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 block mb-1">N° ordonnance</span>
          <input
            value={ordonnanceNumero}
            onChange={(event) => setOrdonnanceNumero(event.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </label>
      </div>

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !dateDebut || Number(dureeJours) < 1}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={13} />
          {saving ? "Enregistrement…" : "Enregistrer les corrections"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-xs text-gray-600 border rounded-lg bg-white hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
