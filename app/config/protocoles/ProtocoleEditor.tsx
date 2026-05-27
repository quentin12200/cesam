"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X, Pencil } from "lucide-react";
import type { ProtocoleVaccinConfig } from "@/lib/utils";

interface Props {
  protocoles: ProtocoleVaccinConfig[];
}

interface EditState {
  label: string;
  ageMinJours: string;
  urgenceJours: string;
  delaiRappelJours: string;
  urgenceRappelJours: string;
  voiePrimo: string;
  voieRappel: string;
  rappelAnnuel: boolean;
}

export default function ProtocoleEditor({ protocoles }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    label: "",
    ageMinJours: "",
    urgenceJours: "",
    delaiRappelJours: "",
    urgenceRappelJours: "",
    voiePrimo: "IM",
    voieRappel: "IM",
    rappelAnnuel: false,
  });
  const [saving, setSaving] = useState(false);

  function startEdit(p: ProtocoleVaccinConfig) {
    setEditing(p.id);
    setEditState({
      label: p.label,
      ageMinJours: String(p.ageMinJours),
      urgenceJours: p.urgenceJours != null ? String(p.urgenceJours) : "",
      delaiRappelJours: p.delaiRappelJours != null ? String(p.delaiRappelJours) : "",
      urgenceRappelJours: p.urgenceRappelJours != null ? String(p.urgenceRappelJours) : "",
      voiePrimo: p.voiePrimo ?? "IM",
      voieRappel: p.voieRappel ?? "IM",
      rappelAnnuel: p.rappelAnnuel ?? false,
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch(`/api/protocoles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editState.label,
        ageMinJours: Number(editState.ageMinJours) || 0,
        urgenceJours: editState.urgenceJours !== "" ? Number(editState.urgenceJours) : null,
        delaiRappelJours: editState.delaiRappelJours !== "" ? Number(editState.delaiRappelJours) : null,
        urgenceRappelJours: editState.urgenceRappelJours !== "" ? Number(editState.urgenceRappelJours) : null,
        voiePrimo: editState.voiePrimo,
        voieRappel: editState.voieRappel,
        rappelAnnuel: editState.rappelAnnuel,
      }),
    });
    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  async function toggleActif(p: ProtocoleVaccinConfig) {
    await fetch(`/api/protocoles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !p.actif }),
    });
    router.refresh();
  }

  async function toggleObligatoire(p: ProtocoleVaccinConfig) {
    await fetch(`/api/protocoles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligatoireVente: !p.obligatoireVente }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {protocoles.map((p) => (
        <div
          key={p.id}
          className={`bg-white rounded-xl shadow border p-4 ${!p.actif ? "opacity-60" : ""}`}
        >
          {editing === p.id ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">
                  {p.nom}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(p.id)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save size={14} /> Sauver
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg border"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Libellé affiché</label>
                <input
                  type="text"
                  value={editState.label}
                  onChange={(e) => setEditState((s) => ({ ...s, label: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {!p.estRappel ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Âge min. (jours)</label>
                    <input
                      type="number"
                      min={0}
                      value={editState.ageMinJours}
                      onChange={(e) => setEditState((s) => ({ ...s, ageMinJours: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Urgence à (jours)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="vide = pas d'urgence"
                      value={editState.urgenceJours}
                      onChange={(e) => setEditState((s) => ({ ...s, urgenceJours: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Délai rappel (jours)</label>
                    <input
                      type="number"
                      min={1}
                      value={editState.delaiRappelJours}
                      onChange={(e) => setEditState((s) => ({ ...s, delaiRappelJours: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Urgence rappel (jours)</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="vide = délai+14"
                      value={editState.urgenceRappelJours}
                      onChange={(e) => setEditState((s) => ({ ...s, urgenceRappelJours: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Voie primo-injection</label>
                  <select
                    value={editState.voiePrimo}
                    onChange={(e) => setEditState((s) => ({ ...s, voiePrimo: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {["IM", "SC", "IV", "IN", "PO"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Voie rappel</label>
                  <select
                    value={editState.voieRappel}
                    onChange={(e) => setEditState((s) => ({ ...s, voieRappel: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {["IM", "SC", "IV", "IN", "PO"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editState.rappelAnnuel}
                  onChange={(e) => setEditState((s) => ({ ...s, rappelAnnuel: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-gray-700">Rappel annuel</span>
              </label>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">
                    {p.nom}
                  </span>
                  {p.estRappel && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">rappel</span>
                  )}
                  {p.obligatoireVente && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">vente</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-800">{p.label}</div>
                <div className="mt-1 text-xs text-gray-500 space-x-3">
                  {!p.estRappel ? (
                    <>
                      <span>Âge min : {p.ageMinJours}j</span>
                      {p.urgenceJours != null && <span>Urgence : J+{p.urgenceJours}</span>}
                      {p.voiePrimo && <span>Voie P : {p.voiePrimo}</span>}
                      {p.voieRappel && <span>Voie R : {p.voieRappel}</span>}
                      {p.rappelAnnuel && <span>Rappel annuel</span>}
                    </>
                  ) : (
                    <>
                      {p.primoNom && <span>Après : {p.primoNom}</span>}
                      {p.delaiRappelJours != null && <span>Délai : {p.delaiRappelJours}j</span>}
                      {p.urgenceRappelJours != null && <span>Urgence : J+{p.urgenceRappelJours}</span>}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleObligatoire(p)}
                  title={p.obligatoireVente ? "Retirer obligation vente" : "Marquer obligatoire vente"}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    p.obligatoireVente
                      ? "bg-orange-100 border-orange-300 text-orange-700"
                      : "bg-white border-gray-200 text-gray-400 hover:border-orange-300"
                  }`}
                >
                  Vente
                </button>
                <button
                  onClick={() => startEdit(p)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg border border-transparent hover:border-gray-200 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => toggleActif(p)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    p.actif ? "bg-green-500" : "bg-gray-300"
                  }`}
                  title={p.actif ? "Désactiver" : "Activer"}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      p.actif ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
