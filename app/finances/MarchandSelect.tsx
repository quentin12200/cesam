"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Marchand { id: string; nom: string }
interface MarchandsResponse { marchands: Marchand[]; suggestions: string[] }

export default function MarchandSelect({ value, onChange }: { value: string; onChange: (nom: string) => void }) {
  const [marchands, setMarchands] = useState<Marchand[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(value ? [value] : []);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [gestionOuverte, setGestionOuverte] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marchands")
      .then(async (response) => {
        if (!response.ok) throw new Error("Impossible de charger les marchands");
        return response.json() as Promise<MarchandsResponse>;
      })
      .then((data) => {
        setMarchands(data.marchands);
        setSuggestions([...new Set([...(value ? [value] : []), ...data.suggestions])]
          .filter((nom) => !data.marchands.some((marchand) => marchand.nom === nom)));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Erreur de chargement"));
  }, [value]);

  async function ajouter() {
    const nom = nouveauNom.trim();
    if (!nom) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/marchands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Création impossible");
      const marchand = data as Marchand;
      setMarchands((current) => [...current.filter((item) => item.id !== marchand.id), marchand].sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
      setSuggestions((current) => current.filter((item) => item.toLocaleLowerCase("fr-FR") !== marchand.nom.toLocaleLowerCase("fr-FR")));
      onChange(marchand.nom);
      setNouveauNom(""); setAjoutOuvert(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible");
    } finally { setSaving(false); }
  }

  async function supprimer(marchand: Marchand) {
    if (!window.confirm(`Supprimer ${marchand.nom} de la liste des marchands ? Les anciennes ventes restent inchangées.`)) return;
    setError(null);
    const response = await fetch(`/api/marchands/${marchand.id}`, { method: "DELETE" });
    if (!response.ok) { setError("Suppression impossible"); return; }
    setMarchands((current) => current.filter((item) => item.id !== marchand.id));
    setSuggestions((current) => [...new Set([marchand.nom, ...current])]);
  }

  return <div className="space-y-2">
    <select value={value} onChange={(event) => {
      if (event.target.value === "__nouveau__") { setAjoutOuvert(true); return; }
      onChange(event.target.value);
    }} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
      <option value="">Sélectionner un marchand…</option>
      {marchands.length > 0 && <optgroup label="Marchands enregistrés">{marchands.map((marchand) => <option key={marchand.id} value={marchand.nom}>{marchand.nom}</option>)}</optgroup>}
      {suggestions.length > 0 && <optgroup label="Acheteurs d’anciennes ventes">{suggestions.map((nom) => <option key={nom} value={nom}>{nom}</option>)}</optgroup>}
      <option value="__nouveau__">+ Ajouter un marchand</option>
    </select>
    {ajoutOuvert && <div className="flex flex-wrap gap-2"><input autoFocus value={nouveauNom} onChange={(event) => setNouveauNom(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void ajouter(); } }} placeholder="Nom du marchand" className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm" /><button type="button" onClick={() => void ajouter()} disabled={saving || !nouveauNom.trim()} className="min-h-11 rounded-lg bg-green-700 px-3 text-sm font-medium text-white disabled:opacity-50"><Plus size={16} className="inline" /> Ajouter</button><button type="button" onClick={() => { setAjoutOuvert(false); setNouveauNom(""); }} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-600">Annuler</button></div>}
    {marchands.length > 0 && <button type="button" onClick={() => setGestionOuverte((open) => !open)} className="text-xs font-medium text-gray-500 underline underline-offset-2">{gestionOuverte ? "Fermer la gestion" : "Gérer les marchands"}</button>}
    {gestionOuverte && <div className="divide-y rounded-lg border border-gray-200">{marchands.map((marchand) => <div key={marchand.id} className="flex min-h-11 items-center justify-between gap-2 px-3"><span className="truncate text-sm text-gray-700">{marchand.nom}</span><button type="button" onClick={() => void supprimer(marchand)} className="p-2 text-red-600" aria-label={`Supprimer ${marchand.nom}`}><Trash2 size={16} /></button></div>)}</div>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>;
}
