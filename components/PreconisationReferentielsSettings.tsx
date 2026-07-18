"use client";

import { useEffect, useState } from "react";

type Valeur = { id: string; type: string; libelle: string; actif: boolean };

export default function PreconisationReferentielsSettings() {
  const [valeurs, setValeurs] = useState<Valeur[]>([]);
  useEffect(() => { void fetch("/api/referentiels-preconisation").then((r) => r.json()).then(setValeurs); }, []);
  if (!valeurs.length) return null;
  async function basculer(valeur: Valeur) { await fetch("/api/referentiels-preconisation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: valeur.id, actif: !valeur.actif }) }); setValeurs((items) => items.map((item) => item.id === valeur.id ? { ...item, actif: !item.actif } : item)); }
  return <details className="mt-5 border-t border-gray-100 pt-4"><summary className="cursor-pointer text-sm font-bold text-gray-800">Listes des préconisations</summary><div className="mt-2 space-y-1">{valeurs.map((valeur) => <div key={valeur.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-gray-50 px-3 text-xs"><input value={valeur.libelle} onChange={(e) => setValeurs((items) => items.map((item) => item.id === valeur.id ? { ...item, libelle: e.target.value } : item))} onBlur={() => void fetch("/api/referentiels-preconisation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: valeur.id, actif: valeur.actif, libelle: valeur.libelle }) })} className="min-w-0 flex-1 bg-transparent" /><small className="text-gray-400">{valeur.type}</small><button type="button" onClick={() => void basculer(valeur)} className={valeur.actif ? "text-green-700" : "text-gray-400"}>{valeur.actif ? "Active" : "Désactivée"}</button></div>)}</div></details>;
}
