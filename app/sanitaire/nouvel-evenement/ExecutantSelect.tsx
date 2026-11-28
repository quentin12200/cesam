"use client";

import { useState } from "react";
import { useActiveExecutor } from "@/components/UserPreferencesProvider";

export interface Intervenant {
  id: string;
  nom: string;
}

interface Props {
  intervenants: Intervenant[];
  simulation?: boolean;
  value: string;
  onChange: (nom: string) => void;
  onAdded: (intervenant: Intervenant) => void;
}

export default function ExecutantSelect({ intervenants, value, onChange, onAdded, simulation = false }: Props) {
  const profile = useActiveExecutor();
  const profils = profile === "Samuel" ? ["Samuel", "Céline"] : ["Céline", "Samuel"];
  const noms = [...new Set([...(simulation ? [] : profils), ...intervenants.map(i => i.nom).filter(Boolean).filter(n => simulation || !profils.includes(n)).sort((a,b)=>a.localeCompare(b,"fr")), ...(value ? [value] : [])])];
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [saving, setSaving] = useState(false);

  async function ajouter() {
    const nom = nouveauNom.trim();
    if (!nom || simulation) return;
    setSaving(true);
    try {
      const res = await fetch("/api/intervenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom }),
      });
      if (!res.ok) return;
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
      {noms.map((nom) => <option key={nom} value={nom}>{nom}</option>)}
      {!simulation && <option value="__nouveau__">+ Ajouter une personne…</option>}
    </select>
  );
}
