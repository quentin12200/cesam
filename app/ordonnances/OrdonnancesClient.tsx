"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ScanLine, Loader2, Archive, FileText, Save, X, Camera, ClipboardCheck } from "lucide-react";
import { scanAndCreateExtraction, type OrdonnanceExtracted } from "@/lib/scan-ordonnance-client";
import { ajouterPagesOrdonnance, supprimerPageOrdonnance } from "@/lib/ordonnance-scan-pages";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import { formaterMedicamentPourListe } from "@/lib/ordonnance-display";

export interface OrdonnanceItem {
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
  voie: string | null;
  dureeJours: number | null;
  motif: string | null;
  animaux: string | null;
  statut: string;
  notes: string | null;
  photoUrl: string | null;
  sourceKey: string;
  medicaments?: Array<{ nomExtrait: string; conditionnement?: string | null }>;
}

export interface ExtractionAVerifierItem {
  id: string;
  analyseLe: string;
  medicamentNom: string | null;
  ordonnanceNumero: string | null;
}

function OrdonnanceForm({
  onClose,
  initial,
  existingId,
}: {
  onClose: () => void;
  initial?: Partial<OrdonnanceExtracted>;
  existingId?: string | null;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(initial?.dateDebut?.slice(0, 10) ?? today);
  const [numero, setNumero] = useState(initial?.ordonnanceNumero ?? "");
  const [veterinaireNom, setVeterinaireNom] = useState(initial?.veterinaire ?? "");
  const [medicamentNom, setMedicamentNom] = useState(initial?.medicamentNom ?? "");
  const [dose, setDose] = useState(initial?.dose != null ? String(initial.dose) : "");
  const [uniteDosage, setUniteDosage] = useState(initial?.uniteDosage ?? "ml");
  const [voie, setVoie] = useState(initial?.voie ?? "");
  const [dureeJours, setDureeJours] = useState(initial?.dureeJours != null ? String(initial.dureeJours) : "");
  const [motif, setMotif] = useState(initial?.motif ?? "");
  const [animaux, setAnimaux] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      date,
      numero: numero || null,
      veterinaireNom: veterinaireNom || null,
      medicamentNom,
      dose: dose !== "" ? Number(dose) : null,
      uniteDosage: uniteDosage || null,
      voie: voie || null,
      dureeJours: dureeJours !== "" ? Number(dureeJours) : null,
      motif: motif || null,
      animaux: animaux || null,
    };
    if (existingId) {
      await fetch(`/api/ordonnances/${existingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/ordonnances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-blue-800">Nouvelle ordonnance</span>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

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
        <label className="text-xs text-gray-500 block mb-1">Vétérinaire *</label>
        <input value={veterinaireNom} onChange={(e) => setVeterinaireNom(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Dr Dupont" />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Médicament *</label>
        <input value={medicamentNom} onChange={(e) => setMedicamentNom(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm uppercase" placeholder="ex: METACAM" required />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Dose</label>
          <input type="number" min={0} step="0.1" value={dose} onChange={(e) => setDose(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
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

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !medicamentNom.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          <Save size={14} /> Enregistrer
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </form>
  );
}

function OrdonnanceCard({ ord }: { ord: OrdonnanceItem }) {
  const router = useRouter();
  const { hrefWithOrigin } = useOriginNavigation();
  const [archiving, setArchiving] = useState(false);

  async function archive() {
    setArchiving(true);
    await fetch(`/api/ordonnances/${ord.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: ord.statut === "ARCHIVE" ? "VALIDE" : "ARCHIVE" }),
    });
    setArchiving(false);
    router.refresh();
  }

  const dateStr = new Date(ord.date).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <div className={`bg-white rounded-xl shadow border p-4 ${ord.statut === "ARCHIVE" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={hrefWithOrigin(`/ordonnances/${ord.id}?source=${encodeURIComponent(ord.sourceKey)}`)}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-700">
              {dateStr}
            </span>
            {ord.numero && (
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                n°{ord.numero}
              </span>
            )}
            {ord.photoUrl && (
              <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                <Camera size={11} /> Document
              </span>
            )}
            {ord.statut === "ARCHIVE" && (
              <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Archivée</span>
            )}
          </div>

          <div className="mt-1.5">
            {ord.medicaments && ord.medicaments.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-gray-500">
                  {ord.medicaments.length} médicament{ord.medicaments.length > 1 ? "s" : ""}
                </div>
                <div className="mt-1 space-y-0.5">
                  {ord.medicaments.map((medicament, index) => {
                    const affichage = formaterMedicamentPourListe(medicament);
                    return (
                      <div key={`${medicament.nomExtrait}-${index}`} className="min-w-0 py-0.5">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0 line-clamp-2 text-sm font-semibold leading-tight text-gray-900">
                            {affichage.nom}
                          </span>
                          {affichage.quantite !== null && (
                            <span className="shrink-0 text-xs font-semibold text-gray-600">
                              Qté {affichage.quantite}
                            </span>
                          )}
                        </div>
                        {affichage.presentation && (
                          <div className="mt-0.5 truncate text-xs text-gray-500">
                            {affichage.presentation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span className="text-sm font-semibold text-gray-900">{ord.medicamentNom || "—"}</span>
            )}
            {(!ord.medicaments || ord.medicaments.length <= 1) && (ord.voie || ord.dose != null || ord.dureeJours) && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {ord.voie && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{ord.voie}</span>}
                {ord.dose != null && (
                  <span className="text-xs text-gray-500">
                    {ord.dose} {ord.uniteDosage ?? "ml"}
                    {ord.referenceValue != null && ` / ${ord.referenceValue} ${ord.referenceUnit ?? "kg"}`}
                    {ord.referenceType === "live_weight" && " de poids vif"}
                  </span>
                )}
                {ord.dureeJours && <span className="text-xs text-gray-400">{ord.dureeJours}j</span>}
              </div>
            )}
          </div>

          {ord.animaux && (
            <div className="text-xs text-gray-400 mt-0.5">Animaux : {ord.animaux}</div>
          )}
        </Link>

        <RecordActionsMenu actions={[{
          label: ord.statut === "ARCHIVE" ? "Repasser à l’état précédent" : "Archiver",
          disabled: archiving,
          onSelect: archive,
        }]} />
      </div>
    </div>
  );
}

export default function OrdonnancesClient({
  ordonnances,
  extractionsAVerifier = [],
}: {
  ordonnances: OrdonnanceItem[];
  extractionsAVerifier?: ExtractionAVerifierItem[];
}) {
  const router = useRouter();
  const { hrefWithOrigin } = useOriginNavigation();
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showArchives, setShowArchives] = useState(false);
  const [deletingExtractionId, setDeletingExtractionId] = useState<string | null>(null);
  const [scanPages, setScanPages] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function supprimerExtraction(id: string) {
    setDeletingExtractionId(id);
    setScanError("");
    try {
      const response = await fetch(`/api/extractions-ordonnance/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "La suppression a échoué");
      router.refresh();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "La suppression a échoué");
    } finally {
      setDeletingExtractionId(null);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setScanPages((pages) => ajouterPagesOrdonnance(pages, files));
    setScanError("");
  }

  async function analyserPages() {
    if (scanPages.length === 0) return;
    setScanning(true);
    setScanError("");
    try {
      const { extractionId } = await scanAndCreateExtraction(scanPages);
      setScanPages([]);
      router.push(hrefWithOrigin(`/ordonnances/a-verifier/${extractionId}`));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "L’analyse du document a échoué");
    } finally {
      setScanning(false);
    }
  }

  const valides = ordonnances.filter((o) => o.statut !== "ARCHIVE");
  const archives = ordonnances.filter((o) => o.statut === "ARCHIVE");

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-2 mb-4">
        {scanPages.length === 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 disabled:opacity-50 shadow-sm"
          >
            <ScanLine size={15} /> Ajouter une première page
          </button>
        )}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm"
        >
          <Plus size={15} /> Nouvelle
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFilePick} />
      </div>

      {showForm && (
        <OrdonnanceForm
          onClose={() => setShowForm(false)}
        />
      )}

      {scanPages.length > 0 && (
        <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3" aria-label="Pages de l’ordonnance">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">
                {scanPages.length} page{scanPages.length > 1 ? "s" : ""} sélectionnée{scanPages.length > 1 ? "s" : ""}
              </h3>
              <p className="text-xs text-blue-700">Les pages seront analysées ensemble, dans cet ordre.</p>
            </div>
            <button
              type="button"
              onClick={() => setScanPages([])}
              disabled={scanning}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>

          <ol className="space-y-2">
            {scanPages.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                <span className="shrink-0 rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                  Page {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setScanPages((pages) => supprimerPageOrdonnance(pages, index))}
                  disabled={scanning}
                  aria-label={`Supprimer la page ${index + 1}`}
                  className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <Plus size={15} /> Ajouter une page
            </button>
            <button
              type="button"
              onClick={analyserPages}
              disabled={scanning || scanPages.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {scanning ? "Analyse…" : "Analyser l’ordonnance"}
            </button>
          </div>
        </section>
      )}

      {scanError && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {scanError}
        </p>
      )}

      {extractionsAVerifier.length > 0 && (
        <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <ClipboardCheck size={16} /> À vérifier ({extractionsAVerifier.length})
          </h3>
          <div className="space-y-1.5">
            {extractionsAVerifier.map((extraction) => (
              <div key={extraction.id} className="flex min-h-11 items-center gap-1 rounded-lg border border-amber-200 bg-white px-1 py-1 hover:bg-amber-50">
                <Link
                  href={hrefWithOrigin(`/ordonnances/a-verifier/${extraction.id}`)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-1 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-gray-800">
                    {extraction.medicamentNom || "Médicament à vérifier"}
                    {extraction.ordonnanceNumero ? ` · n°${extraction.ordonnanceNumero}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(extraction.analyseLe).toLocaleDateString("fr-FR")}
                  </span>
                </Link>
                <RecordActionsMenu actions={[{
                  label: "Supprimer",
                  tone: "danger",
                  disabled: deletingExtractionId === extraction.id,
                  confirmMessage: "Supprimer cette ordonnance à vérifier ? Elle devra être rescannée si vous souhaitez la traiter de nouveau.",
                  confirmLabel: "Supprimer",
                  onSelect: () => supprimerExtraction(extraction.id),
                }]} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* List */}
      {valides.length === 0 && !showForm ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={32} className="mx-auto mb-2" />
          <div className="text-sm">Aucune ordonnance enregistrée</div>
          <div className="text-xs mt-1">Scannez ou saisissez votre première ordonnance</div>
        </div>
      ) : (
        <div className="space-y-3">
          {valides.map((o) => <OrdonnanceCard key={o.id} ord={o} />)}
        </div>
      )}

      {archives.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchives((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <Archive size={12} /> {showArchives ? "Masquer" : "Voir"} les archives ({archives.length})
          </button>
          {showArchives && (
            <div className="space-y-2 mt-2">
              {archives.map((o) => <OrdonnanceCard key={o.id} ord={o} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
