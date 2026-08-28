"use client";

import { FormEvent, useState } from "react";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { resoudreRegleConservation, type RegleConservationBrute } from "@/lib/vaccine-planner";

interface ConditionnementConservation extends RegleConservationBrute {
  id: string;
  quantiteFlacon: number | null;
  uniteFlacon: string | null;
  doses: number;
}

interface Props {
  medicamentId: string;
  initialMedicament: RegleConservationBrute;
  initialConditionnements: ConditionnementConservation[];
}

const STATUTS = [
  { value: "INCONNUE", label: "Information inconnue" },
  { value: "IMMEDIATE", label: "À utiliser immédiatement" },
  { value: "CONSERVABLE", label: "Peut être conservé" },
];

function libelleConditionnement(item: ConditionnementConservation) {
  const format = [item.quantiteFlacon, item.uniteFlacon].filter((value) => value != null).join(" ");
  return [format || "Format sans volume", item.doses > 0 ? `${item.doses} doses` : null].filter(Boolean).join(" · ");
}

function description(regle: ReturnType<typeof resoudreRegleConservation>) {
  if (regle.statut === "IMMEDIATE") return "À utiliser immédiatement";
  if (regle.statut === "INCONNUE") return "Conservation inconnue · reliquat non réutilisable";
  if (regle.jours == null) return "Durée à renseigner";
  return `${regle.jours} jour${regle.jours > 1 ? "s" : ""}${regle.condition ? ` · ${regle.condition}` : ""}`;
}

export default function ConservationOuvertureSection({
  medicamentId,
  initialMedicament,
  initialConditionnements,
}: Props) {
  const [medicament, setMedicament] = useState(initialMedicament);
  const [conditionnements, setConditionnements] = useState(initialConditionnements);
  const [ouvert, setOuvert] = useState(false);
  const [edition, setEdition] = useState<"medicament" | string | null>(null);
  const [form, setForm] = useState({ statut: "INCONNUE", jours: "", condition: "", source: "", note: "" });
  const [erreur, setErreur] = useState("");

  function commencer(cible: "medicament" | ConditionnementConservation) {
    const value = cible === "medicament" ? medicament : cible;
    setEdition(cible === "medicament" ? "medicament" : cible.id);
    setForm({
      statut: cible === "medicament" ? value.conservationOuvertureStatut || "INCONNUE" : value.conservationOuvertureStatut || "HERITER",
      jours: value.conservationOuvertureJours == null ? "" : String(value.conservationOuvertureJours),
      condition: value.conservationOuvertureCondition || "",
      source: value.conservationOuvertureSource || "",
      note: value.conservationOuvertureNote || "",
    });
    setErreur("");
  }

  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    if (!edition) return;
    const payload = {
      conservationOuvertureStatut: form.statut,
      conservationOuvertureJours: form.jours === "" ? null : Number(form.jours),
      conservationOuvertureCondition: form.condition,
      conservationOuvertureSource: form.source,
      conservationOuvertureNote: form.note,
    };
    const response = await fetch(
      edition === "medicament" ? `/api/medicaments/${medicamentId}` : `/api/conditionnements/${edition}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    const data = await response.json();
    if (!response.ok) {
      setErreur(data.error || "Enregistrement impossible");
      return;
    }
    if (edition === "medicament") setMedicament(data);
    else setConditionnements((items) => items.map((item) => item.id === edition ? { ...item, ...data } : item));
    setEdition(null);
  }

  const regleMedicament = resoudreRegleConservation(medicament);

  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <button type="button" onClick={() => setOuvert((value) => !value)} className="flex w-full items-center justify-between gap-2 text-left">
        <span><span className="block font-semibold text-gray-800">Après ouverture</span><span className="text-xs text-gray-500">{description(regleMedicament)}</span></span>
        {ouvert ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      {ouvert && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <button type="button" onClick={() => commencer("medicament")} className="w-full rounded-lg border p-2 text-left text-sm">
            <b>Règle par défaut</b><span className="block text-xs text-gray-500">{description(regleMedicament)}</span>
          </button>
          {conditionnements.map((item) => {
            const regle = resoudreRegleConservation(medicament, item);
            return (
              <button key={item.id} type="button" onClick={() => commencer(item)} className="w-full rounded-lg border p-2 text-left text-sm">
                <b>{libelleConditionnement(item)}</b>
                <span className="block text-xs text-gray-500">{description(regle)}{regle.origine === "MEDICAMENT" ? " · règle par défaut" : " · surcharge"}</span>
              </button>
            );
          })}
          {edition && (
            <form onSubmit={enregistrer} className="space-y-2 rounded-lg bg-gray-50 p-3">
              <label className="block text-xs text-gray-600">Conservation
                <select value={form.statut} onChange={(event) => setForm((value) => ({ ...value, statut: event.target.value }))} className="mt-1 w-full rounded-lg border bg-white px-2.5 py-2 text-sm">
                  {edition !== "medicament" && <option value="HERITER">Utiliser la règle par défaut</option>}
                  {STATUTS.map((statut) => <option key={statut.value} value={statut.value}>{statut.label}</option>)}
                </select>
              </label>
              {form.statut === "CONSERVABLE" && <label className="block text-xs text-gray-600">Durée après ouverture (jours)
                <input required min="0" type="number" value={form.jours} onChange={(event) => setForm((value) => ({ ...value, jours: event.target.value }))} className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm" />
              </label>}
              {form.statut !== "HERITER" && <div className="grid gap-2 sm:grid-cols-2">
                <input value={form.condition} onChange={(event) => setForm((value) => ({ ...value, condition: event.target.value }))} placeholder="Condition (ex. réfrigérateur)" className="rounded-lg border px-2.5 py-2 text-sm" />
                <input value={form.source} onChange={(event) => setForm((value) => ({ ...value, source: event.target.value }))} placeholder="Source (RCP, vétérinaire…)" className="rounded-lg border px-2.5 py-2 text-sm" />
                <input value={form.note} onChange={(event) => setForm((value) => ({ ...value, note: event.target.value }))} placeholder="Note facultative" className="rounded-lg border px-2.5 py-2 text-sm sm:col-span-2" />
              </div>}
              {erreur && <p className="text-xs text-red-600">{erreur}</p>}
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setEdition(null)} className="rounded-lg border px-3 py-2 text-xs">Annuler</button><button type="submit" className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Save size={13} /> Enregistrer</button></div>
            </form>
          )}
          <p className="text-xs text-gray-400">Sans durée renseignée, CESAM ne réutilise jamais un reliquat lors d’une session future.</p>
        </div>
      )}
    </section>
  );
}
