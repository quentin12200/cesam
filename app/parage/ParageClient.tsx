"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import BackButton from "@/app/components/BackButton";
import AnimalPickerModal from "@/app/sanitaire/nouvel-evenement/AnimalPickerModal";
import type { AnimalOption } from "@/app/sanitaire/nouvel-evenement/AnimalPicker";
import PatteSelector from "@/components/PatteSelector";
import { type PatteParage } from "@/lib/parage";
import HoofPrintIcon from "@/components/HoofPrintIcon";

export interface LigneParage {
  id: string;
  animalId: string;
  nutrav: string;
  nom: string | null;
  date: string;
  motif: string;
  pattes: PatteParage[];
  notes: string | null;
  statut: string;
  dateFait: string | null;
}

interface Groupe {
  id: string;
  nom: string;
}

const today = new Date().toISOString().slice(0, 10);

function dateCourte(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function Ligne({
  ligne,
  historique,
  loading,
  onStatut,
}: {
  ligne: LigneParage;
  historique?: boolean;
  loading: boolean;
  onStatut: (id: string, statut: "A_VOIR" | "FAIT") => void;
}) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Link href={`/troupeau/${ligne.nutrav}`} className="shrink-0 rounded bg-green-50 px-1.5 py-0.5 font-mono text-sm font-bold text-green-700">
          {ligne.nutrav}
        </Link>
        <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{ligne.nom || "Sans nom"}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ligne.motif === "BOITERIE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {ligne.motif === "BOITERIE" ? "Boiterie" : "Parage"} · {historique ? "Vu / fait" : "À voir"}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        <span>Ajoutée le {dateCourte(ligne.date)}</span>
        <span aria-hidden="true">·</span>
        {ligne.pattes.map((patte) => (
          <span key={patte} className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-semibold text-gray-700">{patte}</span>
        ))}
        {historique && ligne.dateFait && <span className="ml-auto text-green-700">Faite le {dateCourte(ligne.dateFait)}</span>}
      </div>

      <div className="mt-1.5 flex items-end gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-600">{ligne.notes || (historique ? "" : "Aucune note")}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => onStatut(ligne.id, historique ? "A_VOIR" : "FAIT")}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${
              historique
                ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {historique ? "Remettre à faire" : "Vu / fait"}
          </button>
      </div>
    </article>
  );
}

export default function ParageClient({
  aFaire,
  historique,
  groupes,
}: {
  aFaire: LigneParage[];
  historique: LigneParage[];
  groupes: Groupe[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [animaux, setAnimaux] = useState<AnimalOption[]>([]);
  const [date, setDate] = useState(today);
  const [motif, setMotif] = useState<"BOITERIE" | "PARAGE">("PARAGE");
  const [pattes, setPattes] = useState<PatteParage[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function ajouter() {
    setError("");
    if (animaux.length === 0) { setError("Sélectionne au moins une vache"); return; }
    if (pattes.length === 0) { setError("Sélectionne au moins une patte"); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/parages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalIds: animaux.map((animal) => animal.id), date, motif, pattes, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "L'ajout a échoué");
      setAnimaux([]);
      setPattes([]);
      setNote("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'ajout a échoué");
    } finally {
      setSaving(false);
    }
  }

  async function changerStatut(id: string, statut: "A_VOIR" | "FAIT") {
    setUpdatingId(id);
    setError("");
    try {
      const response = await fetch(`/api/parages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      if (!response.ok) throw new Error("La mise à jour a échoué");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La mise à jour a échoué");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <HoofPrintIcon size={23} className="shrink-0 text-green-700" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Parage</h1>
            <p className="text-xs text-gray-500">{aFaire.length} vache{aFaire.length > 1 ? "s" : ""} à voir</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-green-700 px-3 text-sm font-semibold text-white hover:bg-green-800"
        >
          {showForm ? <X size={17} /> : <Plus size={17} />}
          {showForm ? "Fermer" : "Ajouter"}
        </button>
      </header>

      {showPicker && (
        <AnimalPickerModal
          selected={animaux}
          onChange={setAnimaux}
          onClose={() => setShowPicker(false)}
          groupes={groupes}
          sexeImpose="F"
        />
      )}

      {showForm && (
        <section className="space-y-4 rounded-lg border border-green-200 bg-white p-4 shadow-sm">
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Vache(s)</span>
            <button type="button" onClick={() => setShowPicker(true)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-left text-sm text-gray-700 hover:border-green-500">
              {animaux.length > 0 ? `${animaux.length} vache${animaux.length > 1 ? "s" : ""} sélectionnée${animaux.length > 1 ? "s" : ""}` : "Choisir dans le troupeau"}
            </button>
            {animaux.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {animaux.map((animal) => <span key={animal.id} className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-800">{animal.nutrav}{animal.nom ? ` · ${animal.nom}` : ""}</span>)}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Date d&apos;ajout</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" />
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-600">Motif</span>
              <div className="grid grid-cols-2 gap-2">
                {(["PARAGE", "BOITERIE"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setMotif(value)} className={`min-h-11 rounded-lg border text-sm font-medium ${motif === value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-300 text-gray-600"}`}>
                    {value === "PARAGE" ? "Parage" : "Boiterie"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Patte(s) concernée(s)</span>
            <PatteSelector value={pattes} onChange={setPattes} />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Note (optionnelle)</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Observation pour le pareur…" />
          </label>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" disabled={saving} onClick={ajouter} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
            Ajouter à la liste
          </button>
        </section>
      )}

      {!showForm && error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="space-y-2">
        <h2 className="flex items-center justify-between text-base font-bold text-gray-900">
          <span>À faire</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">{aFaire.length}</span>
        </h2>
        {aFaire.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-400">Aucune vache à montrer au pareur</div>
        ) : (
          <div className="space-y-2">{aFaire.map((ligne) => <Ligne key={ligne.id} ligne={ligne} loading={updatingId === ligne.id} onStatut={changerStatut} />)}</div>
        )}
      </section>

      <details className="group rounded-lg border border-gray-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 font-semibold text-gray-800">
          <span>Historique ({historique.length})</span>
          <ChevronDown size={17} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-gray-100 p-2">
          {historique.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-gray-400">Aucun parage terminé</p>
          ) : historique.map((ligne) => (
            <Ligne key={ligne.id} ligne={ligne} historique loading={updatingId === ligne.id} onStatut={changerStatut} />
          ))}
        </div>
      </details>
    </main>
  );
}
