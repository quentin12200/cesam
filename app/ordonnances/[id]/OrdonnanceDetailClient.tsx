"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, ScanLine, Loader2, RefreshCw, Camera, CheckCircle2, AlertCircle, Beef, CalendarDays, FileText, ExternalLink, Milk, Package, Pencil, RotateCcw, Syringe } from "lucide-react";
import { fileToDocumentDataUrl } from "@/lib/image-client";
import { uploadDataUrlToStorage } from "@/lib/firebase-client";
import { formatDate } from "@/lib/utils";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import {
  formaterConditionnementVisuel,
  formaterRenouvellementUtile,
  formaterRythme,
} from "@/lib/ordonnance-display";
import {
  formaterVoiesConsultation,
  lignesDosePratiqueConsultation,
} from "@/lib/ordonnance-consultation";
import { getCategorieMedicament } from "@/lib/medicament-categories";

interface OrdonnanceData {
  id: string;
  date: string;
  numero: string | null;
  veterinaireNom: string | null;
  medicamentNom: string;
  dose: number | null;
  uniteDosage: string | null;
  referenceValue: number | null;
  referenceUnit: string | null;
  referenceType: string | null;
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  repeatCondition: string | null;
  administrationInstructions: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteAbatsJ: number | null;
  delaiAttenteLaitJ: number | null;
  voie: string | null;
  dureeJours: number | null;
  motif: string | null;
  animaux: string | null;
  statut: string;
  notes: string | null;
  photoUrl: string | null;
  photoUrls: string[];
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

interface LinkedMedication {
  id: string;
  storageType: "relation" | "legacy";
  ordonnanceId: string;
  nomExtrait: string;
  nomPharmacie: string;
  categorie: string;
  substanceActive: string | null;
  concentration: string | null;
  formePharmaceutique: string | null;
  conditionnement: string | null;
  posologieExtraite: string | null;
  dose: number | null;
  uniteDosage: string | null;
  referenceValue: number | null;
  referenceUnit: string | null;
  normalizedDoseValue: number | null;
  normalizedDoseUnit: string | null;
  voieExtraite: string | null;
  dureeExtraite: number | null;
  administrationCount: number | null;
  administrationIntervalHours: number | null;
  repeatCondition: string | null;
  administrationInstructions: string | null;
  delaiAttenteViande: number | null;
  delaiAttenteAbats: number | null;
  delaiAttenteLait: number | null;
  precautions: string | null;
  statutCorrespondance: string;
}

interface MedicationDraft {
  id: string;
  storageType: "relation" | "legacy";
  ordonnanceId: string;
  nomExtrait: string;
  conditionnement: string;
  voieExtraite: string;
  posologieExtraite: string;
  dose: string;
  uniteDosage: string;
  referenceValue: string;
  referenceUnit: string;
  dureeExtraite: string;
  administrationCount: string;
  administrationIntervalHours: string;
  repeatCondition: string;
  delaiAttenteViande: string;
  delaiAttenteAbats: string;
  delaiAttenteLait: string;
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
  medicaments,
  traitements,
  vaccinations,
}: {
  ordonnance: OrdonnanceData;
  medicaments: LinkedMedication[];
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
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeResult, setReanalyzeResult] = useState<Extracted | null>(null);
  const [error, setError] = useState("");
  const [medicationDrafts, setMedicationDrafts] = useState<MedicationDraft[]>(() => medicaments.map((medicament) => ({
    id: medicament.id,
    storageType: medicament.storageType,
    ordonnanceId: medicament.ordonnanceId,
    nomExtrait: medicament.nomExtrait,
    conditionnement: medicament.conditionnement ?? "",
    voieExtraite: medicament.voieExtraite ?? "",
    posologieExtraite: medicament.posologieExtraite ?? "",
    dose: medicament.dose?.toString() ?? "",
    uniteDosage: medicament.uniteDosage ?? "",
    referenceValue: medicament.referenceValue?.toString() ?? "",
    referenceUnit: medicament.referenceUnit ?? "",
    dureeExtraite: medicament.dureeExtraite?.toString() ?? "",
    administrationCount: medicament.administrationCount?.toString() ?? "",
    administrationIntervalHours: medicament.administrationIntervalHours?.toString() ?? "",
    repeatCondition: medicament.repeatCondition ?? "",
    delaiAttenteViande: medicament.delaiAttenteViande?.toString() ?? "",
    delaiAttenteAbats: medicament.delaiAttenteAbats?.toString() ?? "",
    delaiAttenteLait: medicament.delaiAttenteLait?.toString() ?? "",
  })));
  const documentUrlsAffiches = photoUrl && !ordonnance.photoUrls.includes(photoUrl)
    ? [photoUrl]
    : ordonnance.photoUrls;

  function updateMedication(
    id: string,
    field: keyof Omit<MedicationDraft, "id" | "storageType" | "ordonnanceId">,
    value: string,
  ) {
    setMedicationDrafts((current) => current.map((medicament) => (
      medicament.id === id ? { ...medicament, [field]: value } : medicament
    )));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch(`/api/ordonnances/${ordonnance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, numero: numero || null, veterinaireNom: veterinaireNom || null,
          ...(medicationDrafts.length === 0 && {
            medicamentNom, dose: dose !== "" ? Number(dose) : null, uniteDosage: uniteDosage || null,
            voie: voie || null, dureeJours: dureeJours !== "" ? Number(dureeJours) : null,
          }),
          medicaments: medicationDrafts,
          motif: motif || null, animaux: animaux || null,
        }),
      });
      if (!response.ok) throw new Error("Enregistrement impossible");
      if (completeToOrigin("✓ Ordonnance enregistrée !")) return;
      setSaved(true);
      setEditing(false);
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
      <section className="rounded-xl bg-white p-4 shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">Ordonnance du {formatDate(new Date(ordonnance.date))}</p>
            {ordonnance.numero && <p className="mt-0.5 text-sm text-gray-600">n°{ordonnance.numero}</p>}
            {ordonnance.veterinaireNom && <p className="mt-1 text-sm text-gray-600">{ordonnance.veterinaireNom}</p>}
            {ordonnance.motif && <p className="mt-1 text-sm text-gray-600">Motif : {ordonnance.motif}</p>}
            {ordonnance.animaux && <p className="mt-1 text-sm text-gray-500">Animaux : {ordonnance.animaux}</p>}
          </div>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={14} /> {editing ? "Fermer" : "Modifier l’ordonnance"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {documentUrlsAffiches.length > 0 ? documentUrlsAffiches.map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
            >
              <FileText size={15} /> Document original{documentUrlsAffiches.length > 1 ? ` · page ${index + 1}` : ""}
              <ExternalLink size={13} />
            </a>
          )) : <p className="text-sm text-gray-400">Aucun document conservé</p>}
        </div>

        {editing && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => replaceRef.current?.click()}
              disabled={replacing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
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
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                {reanalyzing ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                Réanalyser
              </button>
            )}
          </div>
        )}

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
      </section>

      {medicaments.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow">
          <h3 className="font-semibold text-gray-800">
            {medicaments.length} médicament{medicaments.length > 1 ? "s" : ""}
          </h3>
          <div className="mt-3 space-y-3">
            {medicaments.map((medicament) => {
              const conditionnementVisuel = formaterConditionnementVisuel(medicament.conditionnement);
              const dosesPratiques = lignesDosePratiqueConsultation(medicament.posologieExtraite);
              const voie = formaterVoiesConsultation(medicament.voieExtraite);
              const rythme = formaterRythme({
                administrationCount: medicament.administrationCount?.toString() ?? "",
                administrationInstructions: medicament.administrationInstructions ?? "",
              });
              const renouvellement = formaterRenouvellementUtile({
                administrationIntervalHours: medicament.administrationIntervalHours?.toString() ?? "",
                repeatCondition: medicament.repeatCondition ?? "",
              });
              const delaisViandeAbats = medicament.delaiAttenteViande != null
                && medicament.delaiAttenteViande === medicament.delaiAttenteAbats;
              const categorie = medicament.categorie ? getCategorieMedicament(medicament.categorie) : null;

              return (
                <article key={medicament.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-gray-950">{medicament.nomPharmacie}</p>
                    {categorie && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: categorie.bg, borderColor: categorie.border, color: categorie.text }}
                      >
                        {categorie.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {conditionnementVisuel.ligne && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                        <Package size={13} className="shrink-0 text-gray-500" />{conditionnementVisuel.ligne}
                      </span>
                    )}
                    {conditionnementVisuel.totalDoses && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">{conditionnementVisuel.totalDoses}</span>
                    )}
                    {voie && <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-800"><Syringe size={13} /> {voie}</span>}
                  </div>

                  {dosesPratiques.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-gray-900">
                      {dosesPratiques.map((dose) => <p key={dose}>{dose}</p>)}
                    </div>
                  )}

                  {(rythme || medicament.dureeExtraite != null || renouvellement) && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700">
                      {rythme && <p className="flex items-start gap-1.5"><CalendarDays size={14} className="mt-0.5 shrink-0 text-blue-700" />{rythme}</p>}
                      {medicament.dureeExtraite != null && (
                        <p className="flex items-start gap-1.5"><CalendarDays size={14} className="mt-0.5 shrink-0 text-blue-700" />Pendant {medicament.dureeExtraite} jour{medicament.dureeExtraite > 1 ? "s" : ""}</p>
                      )}
                      {renouvellement && <p className="flex items-start gap-1.5"><RotateCcw size={14} className="mt-0.5 shrink-0 text-violet-700" />{renouvellement}</p>}
                    </div>
                  )}

                  {(medicament.delaiAttenteViande != null || medicament.delaiAttenteAbats != null || medicament.delaiAttenteLait != null) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-medium text-orange-900">
                      {(medicament.delaiAttenteViande != null || medicament.delaiAttenteAbats != null) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1"><Beef size={12} />{
                          delaisViandeAbats
                            ? `Viande/abats ${medicament.delaiAttenteViande} j`
                            : [
                              medicament.delaiAttenteViande != null ? `Viande ${medicament.delaiAttenteViande} j` : null,
                              medicament.delaiAttenteAbats != null ? `Abats ${medicament.delaiAttenteAbats} j` : null,
                            ].filter(Boolean).join(" · ")
                        }</span>
                      )}
                      {medicament.delaiAttenteLait != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1"><Milk size={12} />Lait {medicament.delaiAttenteLait} j</span>
                      )}
                    </div>
                  )}

                  <details className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-600">
                    <summary className="cursor-pointer font-medium text-gray-600">Voir les détails</summary>
                    <div className="mt-2 space-y-1">
                      {medicament.nomExtrait !== medicament.nomPharmacie && <p>Lu sur le document : {medicament.nomExtrait}</p>}
                      {medicament.categorie && <p>Catégorie : {medicament.categorie}</p>}
                      {medicament.substanceActive && <p>Substance active : {medicament.substanceActive}</p>}
                      {medicament.concentration && <p>Concentration : {medicament.concentration}</p>}
                      {medicament.formePharmaceutique && <p>Forme : {medicament.formePharmaceutique}</p>}
                      {medicament.dose != null && medicament.uniteDosage && (
                        <p>Dose enregistrée : {medicament.dose} {medicament.uniteDosage}
                          {medicament.referenceValue != null && ` / ${medicament.referenceValue} ${medicament.referenceUnit ?? "kg"}`}
                        </p>
                      )}
                      {medicament.normalizedDoseValue != null && medicament.normalizedDoseUnit && (
                        <p>Dose normalisée : {medicament.normalizedDoseValue} {medicament.normalizedDoseUnit}</p>
                      )}
                      {medicament.repeatCondition && !renouvellement && <p>{medicament.repeatCondition}</p>}
                      {medicament.administrationInstructions && <p>Instructions : {medicament.administrationInstructions}</p>}
                      {medicament.precautions && <p>Précautions : {medicament.precautions}</p>}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Champs éditables historiques, conservés pour compatibilité */}
      {editing && <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Informations</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date de l’ordonnance</label>
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

        {medicationDrafts.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <h4 className="text-sm font-semibold text-gray-800">Médicaments de l’ordonnance</h4>
            {medicationDrafts.map((medicament, index) => (
              <fieldset key={medicament.id} className="space-y-3 rounded-lg border border-gray-200 p-3">
                <legend className="px-1 text-xs font-semibold text-gray-500">Médicament {index + 1}</legend>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Nom lu sur l’ordonnance</label>
                  <input
                    value={medicament.nomExtrait}
                    onChange={(event) => updateMedication(medicament.id, "nomExtrait", event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Conditionnement / quantité délivrée</label>
                    <input
                      value={medicament.conditionnement}
                      onChange={(event) => updateMedication(medicament.id, "conditionnement", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Voie</label>
                    <input
                      value={medicament.voieExtraite}
                      onChange={(event) => updateMedication(medicament.id, "voieExtraite", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {medicament.storageType === "relation" ? (
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Quantité à administrer</label>
                    <textarea
                      value={medicament.posologieExtraite}
                      onChange={(event) => updateMedication(medicament.id, "posologieExtraite", event.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Quantité à administrer</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        ["Valeur", "dose"],
                        ["Unité", "uniteDosage"],
                        ["Pour", "referenceValue"],
                        ["Référence", "referenceUnit"],
                      ] as const).map(([label, field]) => (
                        <label key={field} className="text-xs text-gray-500">
                          {label}
                          <input
                            value={medicament[field]}
                            onChange={(event) => updateMedication(medicament.id, field, event.target.value)}
                            inputMode={field === "dose" || field === "referenceValue" ? "decimal" : undefined}
                            className="mt-1 w-full min-w-0 rounded-lg border px-2 py-2 text-sm text-gray-900"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Durée (j)</label>
                    <input type="number" min={0} value={medicament.dureeExtraite}
                      onChange={(event) => updateMedication(medicament.id, "dureeExtraite", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Administrations</label>
                    <input type="number" min={0} value={medicament.administrationCount}
                      onChange={(event) => updateMedication(medicament.id, "administrationCount", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Intervalle (h)</label>
                    <input type="number" min={0} value={medicament.administrationIntervalHours}
                      onChange={(event) => updateMedication(medicament.id, "administrationIntervalHours", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Renouvellement</label>
                    <input value={medicament.repeatCondition}
                      onChange={(event) => updateMedication(medicament.id, "repeatCondition", event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["Viande (j)", "delaiAttenteViande"],
                    ["Abats (j)", "delaiAttenteAbats"],
                    ["Lait (j)", "delaiAttenteLait"],
                  ] as const).map(([label, field]) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs text-gray-500">{label}</label>
                      <input type="number" min={0} value={medicament[field]}
                        onChange={(event) => updateMedication(medicament.id, field, event.target.value)}
                        className="w-full min-w-0 rounded-lg border px-2 py-2 text-sm" />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {medicationDrafts.length === 0 && <div className="contents">
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

        {ordonnance.referenceValue != null && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
            Posologie : {ordonnance.dose ?? "—"} {ordonnance.uniteDosage ?? ""} / {ordonnance.referenceValue} {ordonnance.referenceUnit ?? "kg"}
            {ordonnance.referenceType === "live_weight" ? " de poids vif" : ""}
          </div>
        )}

        {(ordonnance.administrationCount != null || ordonnance.administrationIntervalHours != null || ordonnance.repeatCondition || ordonnance.administrationInstructions) && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Protocole d’administration</p>
            {ordonnance.administrationCount != null && <p>{ordonnance.administrationCount} administration(s) initiale(s)</p>}
            {ordonnance.administrationIntervalHours != null && <p>Rappel possible après {ordonnance.administrationIntervalHours} h</p>}
            {ordonnance.repeatCondition && <p>{ordonnance.repeatCondition}</p>}
            {ordonnance.administrationInstructions && <p>{ordonnance.administrationInstructions}</p>}
          </div>
        )}

        {(ordonnance.delaiAttenteViandeJ != null || ordonnance.delaiAttenteAbatsJ != null || ordonnance.delaiAttenteLaitJ != null) && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
            <p className="font-semibold">Délais d’attente</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {ordonnance.delaiAttenteViandeJ != null && <span>Viande : {ordonnance.delaiAttenteViandeJ} j</span>}
              {ordonnance.delaiAttenteAbatsJ != null && <span>Abats : {ordonnance.delaiAttenteAbatsJ} j</span>}
              {ordonnance.delaiAttenteLaitJ != null && <span>Lait : {ordonnance.delaiAttenteLaitJ} j</span>}
            </div>
          </div>
        )}
        </div>}

        <div className={`grid gap-3 ${medicationDrafts.length === 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          {medicationDrafts.length === 0 && <div>
            <label className="text-xs text-gray-500 block mb-1">Durée (jours)</label>
            <input type="number" min={1} value={dureeJours} onChange={(e) => setDureeJours(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>}
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
      </div>}

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
