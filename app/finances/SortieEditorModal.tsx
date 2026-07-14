"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { CAUSES_MORTALITE, CAUSES_MORTALITE_LABELS } from "@/lib/utils";

export type SortieNature = "VENTE" | "MORT";
export type SortieCategorie = "VEAU" | "GENISSE" | "VACHE" | "TAUREAU";
export type ModeVente = "VIF" | "CARCASSE";

export interface SortieAnimalOption {
  id: string;
  nutrav: string;
  nobovi: string | null;
  sexbov?: string;
  categorie?: string | null;
}

export interface SortieEditorValues {
  animalId: string;
  date: string;
  nature: SortieNature;
  categorieSortie: SortieCategorie;
  sexeSortie: string;
  modeVente: ModeVente | null;
  acheteur: string | null;
  poidsVifVente: number | null;
  prixKgVif: number | null;
  poidsCarcasse: number | null;
  prixKgCarcasse: number | null;
  prixDefinitifHT: number | null;
  notes: string | null;
  causeMortalite: string | null;
  confirmeAttente: boolean;
}

interface InitialValues {
  animalId?: string;
  date: string;
  nature: SortieNature;
  categorieSortie?: string | null;
  sexeSortie?: string | null;
  modeVente?: string | null;
  acheteur?: string | null;
  poidsVifVente?: number | null;
  prixKgVif?: number | null;
  poidsCarcasse?: number | null;
  prixKgCarcasse?: number | null;
  prixDefinitifHT?: number | null;
  notes?: string | null;
  causeMortalite?: string | null;
}

interface AttenteInfo {
  enAttente: boolean;
  enAttenteViande: boolean;
  dateFinAttenteViande: string | null;
  medicamentNom: string | null;
}

interface Props {
  title: string;
  initial: InitialValues;
  animalLabel?: string;
  animals?: SortieAnimalOption[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: SortieEditorValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const CATEGORIES: Array<{ value: SortieCategorie; label: string }> = [
  { value: "VEAU", label: "Veau" },
  { value: "GENISSE", label: "Génisse" },
  { value: "VACHE", label: "Vache" },
  { value: "TAUREAU", label: "Taureau" },
];

function nombreInitial(value: number | null | undefined) {
  return value == null ? "" : String(Math.round(value * 100) / 100);
}

export function categorieSortieAnimal(categorie?: string | null, sexe?: string): SortieCategorie {
  const valeur = (categorie ?? "").toUpperCase();
  if (valeur.includes("GENISSE")) return "GENISSE";
  if (valeur.includes("VELLE") || valeur.includes("VEAU")) return "VEAU";
  if (valeur.includes("TAUREAU")) return "TAUREAU";
  if (valeur.includes("VACHE")) return "VACHE";
  return sexe === "F" ? "VACHE" : "VEAU";
}

export default function SortieEditorModal({ title, initial, animalLabel, animals, submitLabel = "Enregistrer", onClose, onSubmit, onDelete }: Props) {
  const [animalId, setAnimalId] = useState(initial.animalId ?? "");
  const [date, setDate] = useState(initial.date);
  const [nature, setNature] = useState<SortieNature>(initial.nature);
  const [categorieSortie, setCategorieSortie] = useState<SortieCategorie>((initial.categorieSortie as SortieCategorie) || "VEAU");
  const [sexeSortie, setSexeSortie] = useState(initial.sexeSortie ?? "F");
  const [modeVente, setModeVente] = useState<ModeVente>((initial.modeVente as ModeVente) || "VIF");
  const [acheteur, setAcheteur] = useState(initial.acheteur ?? "");
  const [poidsVifVente, setPoidsVifVente] = useState(nombreInitial(initial.poidsVifVente));
  const [prixKgVif, setPrixKgVif] = useState(nombreInitial(initial.prixKgVif));
  const [poidsCarcasse, setPoidsCarcasse] = useState(nombreInitial(initial.poidsCarcasse));
  const [prixKgCarcasse, setPrixKgCarcasse] = useState(nombreInitial(initial.prixKgCarcasse));
  const [prixDefinitifHT, setPrixDefinitifHT] = useState(nombreInitial(initial.prixDefinitifHT));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [causeMortalite, setCauseMortalite] = useState(initial.causeMortalite ?? "");
  const [attenteInfo, setAttenteInfo] = useState<AttenteInfo | null>(null);
  const [confirmeAttente, setConfirmeAttente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poidsActif = modeVente === "VIF" ? poidsVifVente : poidsCarcasse;
  const prixActif = modeVente === "VIF" ? prixKgVif : prixKgCarcasse;
  const montantCalcule = useMemo(() => {
    if (nature !== "VENTE" || !poidsActif || !prixActif) return null;
    const montant = parseFloat(poidsActif) * parseFloat(prixActif);
    return Number.isFinite(montant) ? Math.round(montant * 100) / 100 : null;
  }, [nature, poidsActif, prixActif]);

  useEffect(() => {
    const animal = animals?.find((item) => item.id === animalId);
    if (!animal) return;
    setCategorieSortie(categorieSortieAnimal(animal.categorie, animal.sexbov));
    setSexeSortie(animal.sexbov === "M" ? "M" : "F");
  }, [animalId, animals]);

  useEffect(() => {
    setConfirmeAttente(false);
    if (!animalId) { setAttenteInfo(null); return; }
    fetch(`/api/traitements/attente?animalId=${animalId}`).then((r) => r.json()).then(setAttenteInfo).catch(() => setAttenteInfo(null));
  }, [animalId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((animals && !animalId) || !date || !categorieSortie || !sexeSortie) {
      setError("Animal, date, catégorie et sexe sont obligatoires");
      return;
    }
    if (nature === "MORT" && !causeMortalite) {
      setError("La cause de mortalité est obligatoire");
      return;
    }
    if (nature === "VENTE" && modeVente === "CARCASSE" && attenteInfo?.enAttenteViande && !confirmeAttente) {
      setError("Cet animal est encore en délai d'attente viande. Coche la confirmation pour continuer.");
      return;
    }
    setLoading(true); setError(null);
    try {
      await onSubmit({
        animalId, date, nature, categorieSortie, sexeSortie,
        modeVente: nature === "VENTE" ? modeVente : null,
        acheteur: nature === "VENTE" && acheteur ? acheteur : null,
        poidsVifVente: poidsVifVente ? parseFloat(poidsVifVente) : null,
        prixKgVif: prixKgVif ? parseFloat(prixKgVif) : null,
        poidsCarcasse: poidsCarcasse ? parseFloat(poidsCarcasse) : null,
        prixKgCarcasse: prixKgCarcasse ? parseFloat(prixKgCarcasse) : null,
        prixDefinitifHT: nature === "VENTE" && prixDefinitifHT ? Math.round(parseFloat(prixDefinitifHT) * 100) / 100 : null,
        notes: notes || null,
        causeMortalite: nature === "MORT" ? causeMortalite : null,
        confirmeAttente,
      });
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur inattendue"); }
    finally { setLoading(false); }
  }

  async function supprimer() {
    if (!onDelete || !confirm("Supprimer cette sortie ?")) return;
    setLoading(true); setError(null);
    try { await onDelete(); }
    catch (err) { setError(err instanceof Error ? err.message : "Erreur inattendue"); }
    finally { setLoading(false); }
  }

  const champ = "w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-t-xl sm:rounded-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0"><h3 className="font-semibold text-gray-800">{title}</h3>{animalLabel && <p className="text-xs text-gray-500 truncate">{animalLabel}</p>}</div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Fermer"><X size={20} className="text-gray-500" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          {animals && <div><label className="block text-sm font-medium text-gray-700 mb-1">Animal *</label><select value={animalId} onChange={(e) => setAnimalId(e.target.value)} required className={champ}><option value="">Sélectionner un animal…</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.nutrav} — {animal.nobovi ?? "Sans nom"}</option>)}</select></div>}

          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nature de la sortie</label><div className="grid grid-cols-2 gap-2">{([['VENTE','Vente'],['MORT','Mort']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setNature(value)} className={`min-h-12 rounded-lg border text-sm font-medium ${nature === value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"}`}>{label}</button>)}</div></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={categorieSortie} onChange={(e) => setCategorieSortie(e.target.value as SortieCategorie)} className={champ}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label><select value={sexeSortie} onChange={(e) => setSexeSortie(e.target.value)} className={champ}><option value="F">Femelle</option><option value="M">Mâle</option></select></div>
          </div>

          {attenteInfo?.enAttente && <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm"><div className="flex items-start gap-2 text-orange-800 font-medium"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>Délai d&apos;attente en cours{attenteInfo.dateFinAttenteViande && ` pour la viande jusqu'au ${new Date(attenteInfo.dateFinAttenteViande).toLocaleDateString("fr-FR")}`}{attenteInfo.medicamentNom && ` (${attenteInfo.medicamentNom})`}.</span></div>{nature === "VENTE" && modeVente === "CARCASSE" && attenteInfo.enAttenteViande && <label className="flex items-start gap-2 mt-2 text-orange-900"><input type="checkbox" checked={confirmeAttente} onChange={(e) => setConfirmeAttente(e.target.checked)} className="mt-0.5" /><span className="text-xs">Je confirme être informé du délai et je valide cette sortie.</span></label>}</div>}

          {nature === "VENTE" && <><div><label className="block text-sm font-medium text-gray-700 mb-1">Mode de vente</label><div className="grid grid-cols-2 gap-2">{([['VIF','Vif'],['CARCASSE','Carcasse']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setModeVente(value)} className={`min-h-12 rounded-lg border text-sm font-medium ${modeVente === value ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-600"}`}>{label}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">{modeVente === "VIF" ? <><div><label className="block text-sm font-medium text-gray-700 mb-1">Poids vif (kg)</label><input type="number" min="0" step="0.1" value={poidsVifVente} onChange={(e) => setPoidsVifVente(e.target.value)} className={champ} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Prix / kg vif (€)</label><input type="number" min="0" step="0.01" value={prixKgVif} onChange={(e) => setPrixKgVif(e.target.value)} className={champ} /></div></> : <><div><label className="block text-sm font-medium text-gray-700 mb-1">Poids carcasse (kg)</label><input type="number" min="0" step="0.1" value={poidsCarcasse} onChange={(e) => setPoidsCarcasse(e.target.value)} className={champ} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Prix / kg carcasse (€)</label><input type="number" min="0" step="0.01" value={prixKgCarcasse} onChange={(e) => setPrixKgCarcasse(e.target.value)} className={champ} /></div></>}</div>
          </>}

          <div><label className="block text-sm font-medium text-gray-700 mb-1">Date de sortie</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={champ} /></div>
          {nature === "VENTE" && <><div><label className="block text-sm font-medium text-gray-700 mb-1">Acheteur</label><input value={acheteur} onChange={(e) => setAcheteur(e.target.value)} className={champ} /></div>{montantCalcule != null && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm"><span className="text-gray-600">Total calculé : </span><span className="font-bold text-green-700 text-base">{montantCalcule.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT</span></div>}<div><label className="block text-sm font-medium text-gray-700 mb-1">Prix définitif HT (€)</label><input type="number" min="0" step="0.01" value={prixDefinitifHT} onChange={(e) => setPrixDefinitifHT(e.target.value)} placeholder={montantCalcule?.toFixed(2) ?? ""} className={champ} /></div></>}
          {nature === "MORT" && <div><label className="block text-sm font-medium text-red-700 mb-1">Cause de mortalité *</label><select value={causeMortalite} onChange={(e) => setCauseMortalite(e.target.value)} className={champ}><option value="">Sélectionner…</option>{CAUSES_MORTALITE.map((cause) => <option key={cause} value={cause}>{CAUSES_MORTALITE_LABELS[cause] ?? cause}</option>)}</select></div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
          <div className="flex gap-3 pt-2">{onDelete && <button type="button" onClick={supprimer} disabled={loading} className="min-h-11 px-3 border border-red-200 text-red-600 rounded-lg text-sm font-medium">Supprimer</button>}<button type="button" onClick={onClose} className="min-h-11 flex-1 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">Annuler</button><button type="submit" disabled={loading} className="min-h-11 flex-1 bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{loading ? "Enregistrement…" : submitLabel}</button></div>
        </form>
      </div>
    </div>
  );
}

