"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Pencil, ChevronDown, ChevronUp, Stethoscope, ArrowLeft, Package, Milk, Beef, Syringe } from "lucide-react";
import ConfirmDeleteButton from "@/app/components/ConfirmDeleteButton";
import {
  getCategorieMedicament,
  abregerVoie,
  formatVoie,
  formatDoseBase,
  formatPrecautions,
  formatStatutConsultation,
  isVisibleEnConsultation,
} from "@/lib/medicament-categories";
import MedicamentDetailClient from "./MedicamentDetailClient";
import PreconisationFields from "./PreconisationFields";
import RecordActionsMenu from "@/components/RecordActionsMenu";
import ConditionnementsSection from "./ConditionnementsSection";
import ConservationOuvertureSection from "./ConservationOuvertureSection";
import { useOriginNavigation } from "@/lib/use-origin-navigation";

interface MedicamentData {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  voie: string | null;
  prescriptionRequise: boolean;
  actif: boolean;
  favori: boolean;
  actions: string | null;
  commentaire: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  stockActuel: number | null;
  stockUnite: string | null;
  stockSeuilAlert: number | null;
  conservationOuvertureStatut: string;
  conservationOuvertureJours: number | null;
  conservationOuvertureCondition: string | null;
  conservationOuvertureSource: string | null;
  conservationOuvertureNote: string | null;
}

interface PreconisationData {
  id: string;
  indicationMotif: string | null;
  categorieAnimaux: string | null;
  agePoidsConcerne: string | null;
  dose: number | null;
  unite: string | null;
  doseBase: string | null;
  voie: string | null;
  frequence: string | null;
  dureeValeur: number | null;
  dureeUnite: string | null;
  nombreAdministrations: number | null;
  precautions: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitTraites: number | null;
  source: string | null;
  statut: string;
  commentaireVerification: string | null;
}

interface TermeData {
  id: string;
  terme: string;
  explication: string;
}

interface OrdonnanceAssociee {
  id: string;
  numero: string | null;
  date: string;
  veterinaireNom: string | null;
  statut: string;
}

interface HistoriqueItem {
  id: string;
  animalNutrav: string;
  animalNom: string | null;
  dateDebut: string;
  dose: number | null;
  uniteDosage: string | null;
  voie: string | null;
  motif: string | null;
  statut: string;
}

interface Props {
  medicament: MedicamentData;
  preconisations: PreconisationData[];
  termes: TermeData[];
  conditionnements: Array<{
    id: string;
    quantiteFlacon: number | null;
    uniteFlacon: string | null;
    doses: number;
    prixFlaconEur: number | null;
    conservationOuvertureStatut: string | null;
    conservationOuvertureJours: number | null;
    conservationOuvertureCondition: string | null;
    conservationOuvertureSource: string | null;
    conservationOuvertureNote: string | null;
  }>;
  ordonnances: OrdonnanceAssociee[];
  historique: HistoriqueItem[];
}

const STATUT_CLASSES: Record<string, string> = {
  "À vérifier": "bg-orange-100 text-orange-700",
  "Vérifié": "bg-green-100 text-green-700",
  "Archivé": "bg-gray-100 text-gray-400",
};
const FREQUENCE_LABELS: Record<string, string> = { DOSE_UNIQUE: "Dose unique", "1_PAR_JOUR": "1 fois / jour", "2_PAR_JOUR": "2 fois / jour", "3_PAR_JOUR": "3 fois / jour", "1_PAR_24H": "1 fois / 24 h", "1_PAR_48H": "1 fois / 48 h", "1_PAR_SEMAINE": "1 fois / semaine" };

function PreconisationCard({ p, medicamentId }: { p: PreconisationData; medicamentId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    indicationMotif: p.indicationMotif ?? "", categorieAnimaux: p.categorieAnimaux ?? "", agePoidsConcerne: p.agePoidsConcerne ?? "", dose: p.dose != null ? String(p.dose) : "", unite: p.unite ?? "", doseBase: p.doseBase ?? "ANIMAL", voie: p.voie ?? "", frequence: p.frequence ?? "", dureeValeur: p.dureeValeur != null ? String(p.dureeValeur) : "", dureeUnite: p.dureeUnite ?? "JOUR", nombreAdministrations: p.nombreAdministrations != null ? String(p.nombreAdministrations) : "", precautions: p.precautions ?? "", delaiAttenteViandeJ: p.delaiAttenteViandeJ != null ? String(p.delaiAttenteViandeJ) : "", delaiAttenteLaitTraites: p.delaiAttenteLaitTraites != null ? String(p.delaiAttenteLaitTraites) : "",
  });
  const statutLabel = formatStatutConsultation(p.statut);
  const precautionsTexte = formatPrecautions(p.precautions);
  const animauxTexte = [p.categorieAnimaux, p.agePoidsConcerne].filter(Boolean).join(" · ");

  async function enregistrer() { await fetch(`/api/preconisations/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setEditing(false); router.refresh(); }
  async function dupliquer() { await fetch("/api/preconisations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, medicamentId, statut: "A_VERIFIER", source: "Duplication" }) }); router.refresh(); }
  async function archiver() { await fetch(`/api/preconisations/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "ARCHIVE" }) }); router.refresh(); }
  async function supprimer() { await fetch(`/api/preconisations/${p.id}`, { method: "DELETE" }); router.refresh(); }

  if (editing) return <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3"><PreconisationFields form={form} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} /><div className="flex gap-2"><button type="button" onClick={() => void enregistrer()} className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Enregistrer</button><button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-lg border bg-white px-4 text-sm">Annuler</button></div></div>;

  return (
    <div className="relative min-h-32 overflow-hidden rounded-xl border border-gray-200 bg-white py-3 pl-20 pr-3 text-sm shadow-sm space-y-2 sm:pl-24">
      <div className={`absolute bottom-3 left-3 top-3 flex w-14 flex-col items-center justify-center overflow-hidden rounded-xl font-bold sm:w-16 ${p.voie === "SC" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}><Syringe size={24} /><span className="mt-1 max-w-full text-center text-2xl leading-none tracking-tight">{abregerVoie(p.voie)}</span></div>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words font-medium text-gray-800">{p.indicationMotif || "Sans indication précisée"}</span>
        <div className="flex items-center"><span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUT_CLASSES[statutLabel]}`}>{statutLabel}</span><RecordActionsMenu onEdit={() => setEditing(true)} actions={[{ label: "Dupliquer", onSelect: dupliquer }, ...(p.statut !== "ARCHIVE" ? [{ label: "Archiver", onSelect: archiver }] : []), { label: "Supprimer", tone: "danger", confirmMessage: "Supprimer cette préconisation ?", onSelect: supprimer }]} /></div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 break-words text-xs text-gray-600 sm:grid-cols-3">
        {animauxTexte && <span>{animauxTexte}</span>}
        {p.dose != null && <span><b className="block text-gray-400 font-medium">Dose</b>{p.dose} {p.unite} {formatDoseBase(p.doseBase)}</span>}
        {p.voie && <span><b className="block text-gray-400 font-medium">Voie</b>{formatVoie(p.voie)}</span>}
        <span><b className="block text-gray-400 font-medium">Fréquence</b>{FREQUENCE_LABELS[p.frequence ?? ""] ?? p.frequence ?? "Dose unique"}</span>
        {p.dureeValeur != null && <span><b className="block text-gray-400 font-medium">Durée</b>{p.dureeValeur} {p.dureeUnite === "48H" ? "× 48h" : "jour(s)"}</span>}
        {p.nombreAdministrations != null && <span>{p.nombreAdministrations} administration{p.nombreAdministrations > 1 ? "s" : ""}</span>}
      </div>
      {(p.delaiAttenteViandeJ != null || p.delaiAttenteLaitTraites != null) && (
        <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs text-gray-600">
          {p.delaiAttenteViandeJ != null && <span className="flex items-center gap-1.5"><Beef size={14} className="text-red-500" /> Viande : {p.delaiAttenteViandeJ} j</span>}
          {p.delaiAttenteLaitTraites != null && <span className="flex items-center gap-1.5"><Milk size={14} className="text-blue-500" /> Lait : {p.delaiAttenteLaitTraites} traite(s)</span>}
        </div>
      )}
      {precautionsTexte && <div className="text-xs text-orange-700">{precautionsTexte}</div>}
    </div>
  );
}

export default function MedicamentFicheClient({ medicament, preconisations, termes, conditionnements, ordonnances, historique }: Props) {
  const { hrefWithOrigin } = useOriginNavigation();
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [savingFavori, setSavingFavori] = useState(false);
  const [showSavoir, setShowSavoir] = useState(false);

  const cat = getCategorieMedicament(medicament.categorie);
  const actionsList = medicament.actions ? medicament.actions.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const preconisationsVisibles = preconisations.filter((p) => isVisibleEnConsultation(p.statut));

  async function toggleFavori() {
    setSavingFavori(true);
    await fetch(`/api/medicaments/${medicament.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favori: !medicament.favori }),
    });
    setSavingFavori(false);
    router.refresh();
  }

  if (editMode) {
    return (
      <div className="space-y-3">
        <button onClick={() => setEditMode(false)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft size={14} /> Retour à la fiche
        </button>
        <MedicamentDetailClient medicament={medicament} preconisations={preconisations} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2 rounded-xl bg-white p-3 shadow">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: cat.bg, color: cat.text }}>
            {cat.label}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${medicament.actif ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{medicament.actif ? "Actif" : "Inactif"}</span>
          <button onClick={toggleFavori} disabled={savingFavori} className="ml-auto p-1" aria-label="Favori"><Star size={17} className={medicament.favori ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} /></button>
          <button onClick={() => setEditMode(true)} className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-500"><Pencil size={12} /> Modifier la fiche</button>
        </div>
        {(medicament.dci || medicament.forme || medicament.prescriptionRequise) && <p className="text-xs text-gray-500">{[medicament.dci, medicament.forme, medicament.prescriptionRequise ? "Ordonnance requise" : null].filter(Boolean).join(" · ")}</p>}
        <div className="flex items-center gap-1.5 border-t pt-2 text-xs text-gray-700"><Package size={14} className="text-gray-400" /><span><b>Stock :</b> {medicament.stockActuel ?? "—"} {medicament.stockUnite ?? ""}{medicament.stockSeuilAlert != null && <> · <b>Alerte :</b> {medicament.stockSeuilAlert} {medicament.stockUnite ?? ""}</>}</span></div>
      </div>

      <Link href={hrefWithOrigin(`/sanitaire/nouvel-evenement?medicament=${medicament.id}`)}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
          <Stethoscope size={14} /> Créer un événement sanitaire avec ce médicament
      </Link>

      {/* Actions / En savoir + */}
      {actionsList.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-2">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {actionsList.map((a) => (
              <span key={a} className="text-sm px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">{a}</span>
            ))}
          </div>
          {termes.length > 0 && (
            <>
              <button onClick={() => setShowSavoir((v) => !v)}
                className="mt-2.5 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                {showSavoir ? <ChevronUp size={12} /> : <ChevronDown size={12} />} En savoir +
              </button>
              {showSavoir && (
                <div className="mt-2 space-y-1.5">
                  {termes.map((t) => (
                    <div key={t.id} className="text-xs text-gray-600">
                      <span className="font-medium text-gray-800">{t.terme}</span> : {t.explication}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConditionnementsSection medicamentId={medicament.id} initialConditionnements={conditionnements} />

      {/* Préconisations */}
      <section className="space-y-3">
        <h3 className="px-1 font-semibold text-gray-800">Préconisations</h3>
        {preconisationsVisibles.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Aucune préconisation enregistrée</p>
        )}
        <div className="space-y-2">
          {preconisationsVisibles.map((p) => <PreconisationCard key={p.id} p={p} medicamentId={medicament.id} />)}
        </div>
      </section>

      <ConservationOuvertureSection
        medicamentId={medicament.id}
        initialMedicament={medicament}
        initialConditionnements={conditionnements}
      />

      {/* Ordonnances associées */}
      <div className="bg-white rounded-xl shadow p-4 space-y-1">
        <h3 className="font-semibold text-gray-800 text-sm mb-1">Ordonnances associées</h3>
        {ordonnances.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucune ordonnance associée</p>}
        {ordonnances.map((o) => (
          <div key={o.id} className="text-sm flex items-center justify-between border-b last:border-0 border-gray-50 py-1.5">
            <span>{o.numero ?? "N° inconnu"} — {o.veterinaireNom ?? "Prescripteur inconnu"}</span>
            <span className="text-xs text-gray-400">{new Date(o.date).toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>

      {/* Historique d'utilisation */}
      <div className="bg-white rounded-xl shadow p-4 space-y-1">
        <h3 className="font-semibold text-gray-800 text-sm mb-1">Historique d&apos;utilisation</h3>
        {historique.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucun traitement enregistré</p>}
        {historique.slice(0, 15).map((h) => (
          <div key={h.id} className="text-sm flex items-center justify-between gap-2 border-b last:border-0 border-gray-50 py-1.5">
            <span className="min-w-0 truncate">
              <Link href={`/troupeau/${h.animalNutrav}`} className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100">
                {h.animalNutrav}
              </Link>
              {h.animalNom && <span className="ml-1.5">{h.animalNom}</span>}
              {h.motif && <span className="text-gray-400 ml-1.5">— {h.motif}</span>}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{new Date(h.dateDebut).toLocaleDateString("fr-FR")}</span>
            <ConfirmDeleteButton url={`/api/traitements/${h.id}`} confirmMessage="Confirmer la suppression de ce traitement ?" />
          </div>
        ))}
      </div>
    </div>
  );
}
