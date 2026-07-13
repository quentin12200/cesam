"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export interface Intervenant {
  id: string;
  nom: string;
}

interface Props {
  intervenants: Intervenant[];
  value: string;
  onChange: (nom: string) => void;
  onAdded: (intervenant: Intervenant) => void;
}

export default function ExecutantSelect({ intervenants, value, onChange, onAdded }: Props) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [saving, setSaving] = useState(false);

  async function ajouter() {
    const nom = nouveauNom.trim();
    if (!nom) return;
    setSaving(true);
    try {
      const res = await fetch("/api/intervenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom }),
      });
      const intervenant: Intervenant = await res.json();
      onAdded(intervenant);
      onChange(intervenant.nom);
      setNouveauNom("");
      setAjoutOuvert(false);
    } finally {
      setSaving(false);
    }
  }

  if (ajoutOuvert) {
    return (
      <div className="flex gap-2">
        <input autoFocus value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
          placeholder="Nom de la personne" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <button type="button" onClick={ajouter} disabled={saving || !nouveauNom.trim()}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
          Ajouter
        </button>
        <button type="button" onClick={() => { setAjoutOuvert(false); setNouveauNom(""); }}
          className="px-3 py-2 text-sm text-gray-500 border rounded-lg">
          Annuler
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nouveau__") setAjoutOuvert(true);
        else onChange(e.target.value);
      }}
      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
    >
      <option value="">Sélectionner…</option>
      {intervenants.map((i) => <option key={i.id} value={i.nom}>{i.nom}</option>)}
      <option value="__nouveau__">+ Ajouter une personne…</option>
    </select>
  );
}
