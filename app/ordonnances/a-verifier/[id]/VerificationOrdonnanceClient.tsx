"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink, FileText, Loader2 } from "lucide-react";

export interface PropositionOrdonnance {
  medicamentNom?: string | null;
  voie?: string | null;
  dose?: number | null;
  uniteDosage?: string | null;
  frequence?: string | null;
  dureeJours?: number | null;
  dateDebut?: string | null;
  veterinaire?: string | null;
  motif?: string | null;
  delaiAttenteViandeJ?: number | null;
  delaiAttenteLaitJ?: number | null;
  precautions?: string | null;
  rappels?: string | null;
  ordonnanceNumero?: string | null;
}

interface ExtractionInfo {
  id: string;
  documentUrl: string;
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

function AffichageIA({ valeur }: { valeur: string | number | null | undefined }) {
  return (
    <p className="mt-1 text-[11px] text-gray-400">
      IA : {valeur === null || valeur === undefined || valeur === "" ? "non trouvé" : String(valeur)}
    </p>
  );
}

function Champ({
  label,
  valeurIA,
  children,
  className = "",
}: {
  label: string;
  valeurIA: string | number | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      <AffichageIA valeur={valeurIA} />
    </label>
  );
}

const inputClass = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

export default function VerificationOrdonnanceClient({
  extraction,
  propositionInitiale,
}: {
  extraction: ExtractionInfo;
  propositionInitiale: PropositionOrdonnance;
}) {
  const router = useRouter();
  const [dateDebut, setDateDebut] = useState(propositionInitiale.dateDebut?.slice(0, 10) ?? "");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState(propositionInitiale.ordonnanceNumero ?? "");
  const [veterinaire, setVeterinaire] = useState(propositionInitiale.veterinaire ?? "");
  const [medicamentNom, setMedicamentNom] = useState(propositionInitiale.medicamentNom ?? "");
  const [dose, setDose] = useState(propositionInitiale.dose != null ? String(propositionInitiale.dose) : "");
  const [uniteDosage, setUniteDosage] = useState(propositionInitiale.uniteDosage ?? "");
  const [voie, setVoie] = useState(propositionInitiale.voie ?? "");
  const [frequence, setFrequence] = useState(propositionInitiale.frequence ?? "");
  const [dureeJours, setDureeJours] = useState(propositionInitiale.dureeJours != null ? String(propositionInitiale.dureeJours) : "");
  const [motif, setMotif] = useState(propositionInitiale.motif ?? "");
  const [animaux, setAnimaux] = useState("");
  const [delaiAttenteViandeJ, setDelaiAttenteViandeJ] = useState(propositionInitiale.delaiAttenteViandeJ != null ? String(propositionInitiale.delaiAttenteViandeJ) : "");
  const [delaiAttenteLaitJ, setDelaiAttenteLaitJ] = useState(propositionInitiale.delaiAttenteLaitJ != null ? String(propositionInitiale.delaiAttenteLaitJ) : "");
  const [precautions, setPrecautions] = useState(propositionInitiale.precautions ?? "");
  const [rappels, setRappels] = useState(propositionInitiale.rappels ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPdf = extraction.documentUrl.toLowerCase().includes(".pdf");

  async function valider(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/extractions-ordonnance/${extraction.id}/valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateDebut,
          ordonnanceNumero,
          veterinaire,
          medicamentNom,
          dose,
          uniteDosage,
          voie,
          frequence,
          dureeJours,
          motif,
          animaux,
          delaiAttenteViandeJ,
          delaiAttenteLaitJ,
          precautions,
          rappels,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "La validation a échoué");
      router.push(`/ordonnances/${data.ordonnanceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={valider} className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <FileText size={16} className="text-blue-600" /> Document analysé
          </h2>
          <a
            href={extraction.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <ExternalLink size={14} /> Ouvrir
          </a>
        </div>
        {isPdf ? (
          <iframe src={extraction.documentUrl} title="Ordonnance originale" className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-50" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={extraction.documentUrl} alt="Ordonnance originale" className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-contain" />
        )}
        <p className="mt-2 text-[11px] text-gray-400">
          Analyse du {new Date(extraction.analyseLe).toLocaleString("fr-FR")} · {extraction.modele} · {extraction.versionPrompt}
        </p>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Informations proposées</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label="Date de l’ordonnance *" valeurIA={propositionInitiale.dateDebut}>
            <input type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Numéro ou référence" valeurIA={propositionInitiale.ordonnanceNumero}>
            <input value={ordonnanceNumero} onChange={(e) => setOrdonnanceNumero(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Vétérinaire ou prescripteur" valeurIA={propositionInitiale.veterinaire} className="sm:col-span-2">
            <input value={veterinaire} onChange={(e) => setVeterinaire(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Médicament principal *" valeurIA={propositionInitiale.medicamentNom} className="sm:col-span-2">
            <input required value={medicamentNom} onChange={(e) => setMedicamentNom(e.target.value)} className={`${inputClass} uppercase`} />
          </Champ>
          <Champ label="Dose" valeurIA={propositionInitiale.dose}>
            <input type="number" min="0" step="0.01" value={dose} onChange={(e) => setDose(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Unité" valeurIA={propositionInitiale.uniteDosage}>
            <input value={uniteDosage} onChange={(e) => setUniteDosage(e.target.value)} className={inputClass} placeholder="ml, mg, g…" />
          </Champ>
          <Champ label="Voie d’administration" valeurIA={propositionInitiale.voie}>
            <input value={voie} onChange={(e) => setVoie(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Fréquence" valeurIA={propositionInitiale.frequence}>
            <input value={frequence} onChange={(e) => setFrequence(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Durée (jours)" valeurIA={propositionInitiale.dureeJours}>
            <input type="number" min="0" value={dureeJours} onChange={(e) => setDureeJours(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Animaux concernés" valeurIA={null}>
            <input value={animaux} onChange={(e) => setAnimaux(e.target.value)} className={inputClass} placeholder="N° travail, lot ou catégorie" />
          </Champ>
          <Champ label="Délai viande (jours)" valeurIA={propositionInitiale.delaiAttenteViandeJ}>
            <input type="number" min="0" value={delaiAttenteViandeJ} onChange={(e) => setDelaiAttenteViandeJ(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Délai lait (jours)" valeurIA={propositionInitiale.delaiAttenteLaitJ}>
            <input type="number" min="0" value={delaiAttenteLaitJ} onChange={(e) => setDelaiAttenteLaitJ(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Motif ou diagnostic" valeurIA={propositionInitiale.motif} className="sm:col-span-2">
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Précautions" valeurIA={propositionInitiale.precautions} className="sm:col-span-2">
            <textarea value={precautions} onChange={(e) => setPrecautions(e.target.value)} rows={2} className={inputClass} />
          </Champ>
          <Champ label="Rappels ou administrations de suivi" valeurIA={propositionInitiale.rappels} className="sm:col-span-2">
            <textarea value={rappels} onChange={(e) => setRappels(e.target.value)} rows={2} className={inputClass} />
          </Champ>
        </div>

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/ordonnances" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Vérifier plus tard
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-green-700 px-5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
            {saving ? "Validation…" : "Valider l’ordonnance"}
          </button>
        </div>
      </section>
    </form>
  );
}
