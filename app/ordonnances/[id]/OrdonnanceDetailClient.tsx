"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ScanLine, Loader2, RefreshCw, Camera, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { fileToDocumentDataUrl } from "@/lib/image-client";
import { uploadDataUrlToStorage } from "@/lib/firebase-client";
import { formatDate } from "@/lib/utils";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import { useOriginNavigation } from "@/lib/use-origin-navigation";

interface OrdonnanceData {
  id: string;
  date: string;
  numero: string | null;
  veterinaireNom: string | null;
  medicamentNom: string;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  dureeJours: number | null;
  motif: string | null;
  animaux: string | null;
  statut: string;
  notes: string | null;
  photoUrl: string | null;
}

interface LinkedTraitement {
  id: string;
  medicamentNom: string;
  dateDebut: string;
  animalNutrav: string;
  animalNom: string | null;
}

interface LinkedVaccination {
  id: string;
  vaccin: string;
  date: string;
  animalNutrav: string;
  animalNom: string | null;
}

interface Extracted {
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

export default function OrdonnanceDetailClient({
  ordonnance,
  traitements,
  vaccinations,
}: {
  ordonnance: OrdonnanceData;
  traitements: LinkedTraitement[];
  vaccinations: LinkedVaccination[];
}) {
  const router = useRouter();
  const { completeToOrigin } = useOriginNavigation();
  const replaceRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(ordonnance.date.slice(0, 10));
  const [numero, setNumero] = useState(ordonnance.numero ?? "");
  const [veterinaireNom, setVeterinaireNom] = useState(ordonnance.veterinaireNom ?? "");
  const [medicamentNom, setMedicamentNom] = useState(ordonnance.medicamentNom);
  const [dose, setDose] = useState(ordonnance.dose != null ? String(ordonnance.dose) : "");
  const [uniteDosage, setUniteDosage] = useState(ordonnance.uniteDosage ?? "ml");
  const [voie, setVoie] = useState(ordonnance.voie ?? "");
  const [dureeJours, setDureeJours] = useState(ordonnance.dureeJours != null ? String(ordonnance.dureeJours) : "");
  const [motif, setMotif] = useState(ordonnance.motif ?? "");
  const [animaux, setAnimaux] = useState(ordonnance.animaux ?? "");

  const [photoUrl, setPhotoUrl] = useState(ordonnance.photoUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeResult, setReanalyzeResult] = useState<Extracted | null>(null);
  const [error, setError] = useState("");

  const isPdf = photoUrl?.includes(".pdf");

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/ordonnances/${ordonnance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, numero: numero || null, veterinaireNom: veterinaireNom || null,
          medicamentNom, dose: dose !== "" ? Number(dose) : null, uniteDosage: uniteDosage || null,
          voie: voie || null, dureeJours: dureeJours !== "" ? Number(dureeJours) : null,
          motif: motif || null, animaux: animaux || null,
        }),
      });
      if (completeToOrigin("✓ Ordonnance enregistrée !")) return;
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReplacing(true);
    setError("");
    try {
      const dataUrl = await fileToDocumentDataUrl(file);
      const ext = file.type === "application/pdf" ? "pdf" : "jpg";
      const path = `ordonnances/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const newUrl = await uploadDataUrlToStorage(dataUrl, path);
      await fetch(`/api/ordonnances/${ordonnance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: newUrl }),
      });
      setPhotoUrl(newUrl);
      router.refresh();
    } catch {
      setError("Le document n'a pas pu être remplacé");
    } finally {
      setReplacing(false);
    }
  }

  async function reanalyser() {
    if (!photoUrl) return;
    setReanalyzing(true);
    setError("");
    setReanalyzeResult(null);
    try {
      const fileRes = await fetch(photoUrl);
      const blob = await fileRes.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture impossible"));
        reader.readAsDataURL(blob);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const res = await fetch("/api/scan-ordonnance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: blob.type || "image/jpeg" }),
      });
      if (!res.ok) throw new Error("Erreur lors de la réanalyse");
      const result: Extracted = await res.json();
      setReanalyzeResult(result);
    } catch {
      setError("La réanalyse a échoué");
    } finally {
      setReanalyzing(false);
    }
  }

  function appliquerReanalyse() {
    if (!reanalyzeResult) return;
    if (reanalyzeResult.medicamentNom) setMedicamentNom(reanalyzeResult.medicamentNom);
    if (reanalyzeResult.voie) setVoie(reanalyzeResult.voie);
    if (reanalyzeResult.dose != null) setDose(String(reanalyzeResult.dose));
    if (reanalyzeResult.uniteDosage) setUniteDosage(reanalyzeResult.uniteDosage);
    if (reanalyzeResult.dureeJours != null) setDureeJours(String(reanalyzeResult.dureeJours));
    if (reanalyzeResult.dateDebut) setDate(reanalyzeResult.dateDebut.slice(0, 10));
    if (reanalyzeResult.veterinaire) setVeterinaireNom(reanalyzeResult.veterinaire);
    if (reanalyzeResult.motif) setMotif(reanalyzeResult.motif);
    if (reanalyzeResult.ordonnanceNumero) setNumero(reanalyzeResult.ordonnanceNumero);
    setReanalyzeResult(null);
  }

  async function toggleArchive() {
    await fetch(`/api/ordonnances/${ordonnance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: ordonnance.statut === "ARCHIVE" ? "VALIDE" : "ARCHIVE" }),
    });
    router.refresh();
  }

  async function supprimer() {
    const res = await fetch(`/api/ordonnances/${ordonnance.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Suppression impossible");
      return;
    }
    if (completeToOrigin("✓ Ordonnance supprimée")) return;
    router.push("/ordonnances");
  }

  const totalLies = traitements.length + vaccinations.length;

  return (
    <div className="space-y-4">
      {/* Document */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Document original</h3>
        {photoUrl ? (
          isPdf ? (
            <a href={photoUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-blue-600 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100">
              <FileText size={16} /> Ouvrir le PDF
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Ordonnance" className="max-h-80 rounded-lg border border-gray-200 mx-auto" />
          )
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">Aucun document conservé</div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => replaceRef.current?.click()}
            disabled={replacing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {replacing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {photoUrl ? "Remplacer le document" : "Ajouter un document"}
          </button>
          <input ref={replaceRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReplace} />

          {photoUrl && (
            <button
              type="button"
              onClick={reanalyser}
              disabled={reanalyzing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              {reanalyzing ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
              Réanalyser
            </button>
          )}
        </div>

        {reanalyzeResult && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <p className="font-medium mb-1">Nouvelle lecture proposée :</p>
            <p>{reanalyzeResult.medicamentNom ?? "—"} · {reanalyzeResult.dose ?? "?"} {reanalyzeResult.uniteDosage ?? ""} · {reanalyzeResult.voie ?? "—"}</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={appliquerReanalyse}
                className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs">Appliquer aux champs</button>
              <button type="button" onClick={() => setReanalyzeResult(null)}
                className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600">Ignorer</button>
            </div>
          </div>
        )}
      </div>

      {/* Champs éditables */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Informations</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">N° ordonnance</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: 2024-042" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Vétérinaire</label>
          <input value={veterinaireNom} onChange={(e) => setVeterinaireNom(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Dr Dupont" />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Médicament</label>
          <input value={medicamentNom} onChange={(e) => setMedicamentNom(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: METACAM" />
        </div>

        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="text-xs text-gray-500 block mb-1">Voie</label>
            <input value={voie} onChange={(e) => setVoie(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="IM" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
            <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Animaux (N° travail)</label>
            <input value={animaux} onChange={(e) => setAnimaux(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: 001, 002" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Motif / diagnostic</label>
          <input value={motif} onChange={(e) => setMotif(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Mammite" />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={13} /> Enregistré</span>}
          <RecordActionsMenu actions={[
            {
              label: ordonnance.statut === "ARCHIVE" ? "Repasser à l’état précédent" : "Archiver",
              onSelect: toggleArchive,
            },
            {
              label: "Supprimer la saisie",
              tone: "danger",
              confirmMessage: "Supprimer cette ordonnance ?",
              onSelect: supprimer,
            },
          ]} />
        </div>
      </div>

      {/* Traitements / vaccinations liés */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <RefreshCw size={15} className="text-gray-400" />
          Rattaché à {totalLies} enregistrement{totalLies > 1 ? "s" : ""}
        </h3>
        {totalLies === 0 ? (
          <p className="text-sm text-gray-400">Aucun traitement ni vaccination rattaché pour l&apos;instant.</p>
        ) : (
          <div className="space-y-1.5">
            {traitements.map((t) => (
              <Link key={t.id} href={`/troupeau/${t.animalNutrav}`}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                <span>{t.medicamentNom} — {t.animalNutrav}{t.animalNom ? ` (${t.animalNom})` : ""}</span>
                <span className="text-xs text-gray-400">{formatDate(new Date(t.dateDebut))}</span>
              </Link>
            ))}
            {vaccinations.map((v) => (
              <Link key={v.id} href={`/troupeau/${v.animalNutrav}`}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                <span>{v.vaccin} — {v.animalNutrav}{v.animalNom ? ` (${v.animalNom})` : ""}</span>
                <span className="text-xs text-gray-400">{formatDate(new Date(v.date))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
