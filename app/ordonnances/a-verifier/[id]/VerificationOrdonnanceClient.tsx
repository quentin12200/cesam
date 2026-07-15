"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import {
  medicamentsDepuisProposition,
  type MedicamentPropose,
  type PropositionOrdonnance,
} from "@/lib/ordonnance-types";

interface ExtractionInfo {
  id: string;
  documentUrls: string[];
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

interface MedChamps {
  key: string;
  ia?: MedicamentPropose;
  medicamentNom: string;
  numeroLot: string;
  dose: string;
  uniteDosage: string;
  voie: string;
  frequence: string;
  dureeJours: string;
  delaiAttenteViandeJ: string;
  delaiAttenteLaitJ: string;
  precautions: string;
  rappels: string;
}

let compteurCle = 0;
function nouvelleCle(): string {
  compteurCle += 1;
  return `med-${compteurCle}-${Math.random().toString(36).slice(2)}`;
}

function s(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function versChamps(m: MedicamentPropose): MedChamps {
  return {
    key: nouvelleCle(),
    ia: m,
    medicamentNom: s(m.medicamentNom),
    numeroLot: s(m.numeroLot),
    dose: s(m.dose),
    uniteDosage: s(m.uniteDosage),
    voie: s(m.voie),
    frequence: s(m.frequence),
    dureeJours: s(m.dureeJours),
    delaiAttenteViandeJ: s(m.delaiAttenteViandeJ),
    delaiAttenteLaitJ: s(m.delaiAttenteLaitJ),
    precautions: s(m.precautions),
    rappels: s(m.rappels),
  };
}

function champsVides(): MedChamps {
  return {
    key: nouvelleCle(),
    medicamentNom: "", numeroLot: "", dose: "", uniteDosage: "", voie: "",
    frequence: "", dureeJours: "", delaiAttenteViandeJ: "", delaiAttenteLaitJ: "",
    precautions: "", rappels: "",
  };
}

const inputClass = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

function AffichageIA({ valeur }: { valeur: string | number | null | undefined }) {
  return (
    <p className="mt-1 text-[11px] text-gray-400">
      IA : {valeur === null || valeur === undefined || valeur === "" ? "non trouvé" : String(valeur)}
    </p>
  );
}

function Champ({
  label, valeurIA, children, className = "",
}: {
  label: string;
  valeurIA?: string | number | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {valeurIA !== undefined && <AffichageIA valeur={valeurIA} />}
    </label>
  );
}

export default function VerificationOrdonnanceClient({
  extraction,
  propositionInitiale,
}: {
  extraction: ExtractionInfo;
  propositionInitiale: PropositionOrdonnance;
}) {
  const router = useRouter();
  const medsInitiaux = medicamentsDepuisProposition(propositionInitiale);

  const [dateDebut, setDateDebut] = useState(propositionInitiale.dateDebut?.slice(0, 10) ?? "");
  const [ordonnanceNumero, setOrdonnanceNumero] = useState(propositionInitiale.ordonnanceNumero ?? "");
  const [veterinaire, setVeterinaire] = useState(propositionInitiale.veterinaire ?? "");
  const [motif, setMotif] = useState(propositionInitiale.motif ?? "");
  const [animaux, setAnimaux] = useState("");
  const [medicaments, setMedicaments] = useState<MedChamps[]>(medsInitiaux.map(versChamps));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function majMed(index: number, champ: keyof MedChamps, valeur: string) {
    setMedicaments((prev) => prev.map((m, i) => (i === index ? { ...m, [champ]: valeur } : m)));
  }
  function ajouterMed() {
    setMedicaments((prev) => [...prev, champsVides()]);
  }
  function retirerMed(index: number) {
    setMedicaments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

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
          motif,
          animaux,
          medicaments: medicaments.map((m) => ({
            medicamentNom: m.medicamentNom,
            numeroLot: m.numeroLot,
            dose: m.dose,
            uniteDosage: m.uniteDosage,
            voie: m.voie,
            frequence: m.frequence,
            dureeJours: m.dureeJours,
            delaiAttenteViandeJ: m.delaiAttenteViandeJ,
            delaiAttenteLaitJ: m.delaiAttenteLaitJ,
            precautions: m.precautions,
            rappels: m.rappels,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "La validation a échoué");
      if (data.count > 1) {
        router.push("/ordonnances");
      } else {
        router.push(`/ordonnances/${data.ordonnanceId}`);
      }
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
            <FileText size={16} className="text-blue-600" />
            {extraction.documentUrls.length > 1 ? `Document (${extraction.documentUrls.length} pages)` : "Document analysé"}
          </h2>
        </div>
        <div className="space-y-3">
          {extraction.documentUrls.map((url, i) => {
            const isPdf = url.toLowerCase().includes(".pdf");
            return (
              <div key={url}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Page {i + 1}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800"
                  >
                    <ExternalLink size={12} /> Ouvrir
                  </a>
                </div>
                {isPdf ? (
                  <iframe src={url} title={`Page ${i + 1}`} className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-50" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Page ${i + 1}`} className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-contain" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Analyse du {new Date(extraction.analyseLe).toLocaleString("fr-FR")} · {extraction.modele} · {extraction.versionPrompt}
        </p>
      </section>

      <section className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Ordonnance</h2>
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
            <Champ label="Motif ou diagnostic" valeurIA={propositionInitiale.motif}>
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
            </Champ>
            <Champ label="Animaux concernés">
              <input value={animaux} onChange={(e) => setAnimaux(e.target.value)} className={inputClass} placeholder="N° travail, lot ou catégorie" />
            </Champ>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              Médicaments ({medicaments.length})
            </h2>
            <span className="text-[11px] text-gray-400">1 médicament = 1 ordonnance</span>
          </div>

          <div className="space-y-4">
            {medicaments.map((med, i) => {
              const ia = med.ia;
              return (
                <div key={med.key} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Médicament {i + 1}</span>
                    {medicaments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => retirerMed(i)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={13} /> Retirer
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Champ label="Nom du médicament *" valeurIA={ia?.medicamentNom} className="sm:col-span-2">
                      <input required value={med.medicamentNom} onChange={(e) => majMed(i, "medicamentNom", e.target.value)} className={`${inputClass} uppercase`} />
                    </Champ>
                    <Champ label="N° de lot" valeurIA={ia?.numeroLot}>
                      <input value={med.numeroLot} onChange={(e) => majMed(i, "numeroLot", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Voie d’administration" valeurIA={ia?.voie}>
                      <input value={med.voie} onChange={(e) => majMed(i, "voie", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Dose" valeurIA={ia?.dose}>
                      <input type="number" min="0" step="0.01" value={med.dose} onChange={(e) => majMed(i, "dose", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Unité" valeurIA={ia?.uniteDosage}>
                      <input value={med.uniteDosage} onChange={(e) => majMed(i, "uniteDosage", e.target.value)} className={inputClass} placeholder="ml, mg, g…" />
                    </Champ>
                    <Champ label="Fréquence" valeurIA={ia?.frequence}>
                      <input value={med.frequence} onChange={(e) => majMed(i, "frequence", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Durée (jours)" valeurIA={ia?.dureeJours}>
                      <input type="number" min="0" value={med.dureeJours} onChange={(e) => majMed(i, "dureeJours", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Délai viande (jours)" valeurIA={ia?.delaiAttenteViandeJ}>
                      <input type="number" min="0" value={med.delaiAttenteViandeJ} onChange={(e) => majMed(i, "delaiAttenteViandeJ", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Délai lait (jours)" valeurIA={ia?.delaiAttenteLaitJ}>
                      <input type="number" min="0" value={med.delaiAttenteLaitJ} onChange={(e) => majMed(i, "delaiAttenteLaitJ", e.target.value)} className={inputClass} />
                    </Champ>
                    <Champ label="Précautions" valeurIA={ia?.precautions} className="sm:col-span-2">
                      <textarea value={med.precautions} onChange={(e) => majMed(i, "precautions", e.target.value)} rows={2} className={inputClass} />
                    </Champ>
                    <Champ label="Rappels ou administrations de suivi" valeurIA={ia?.rappels} className="sm:col-span-2">
                      <textarea value={med.rappels} onChange={(e) => majMed(i, "rappels", e.target.value)} rows={2} className={inputClass} />
                    </Champ>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={ajouterMed}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Plus size={15} /> Ajouter un médicament
          </button>

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
              {saving
                ? "Validation…"
                : medicaments.length > 1
                  ? `Valider ${medicaments.length} ordonnances`
                  : "Valider l’ordonnance"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
