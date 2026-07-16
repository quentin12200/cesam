"use client";

import BackButton from "@/app/components/BackButton";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, Loader2, CheckCircle2, Search, Thermometer, ListChecks, Plus, Syringe, Mic } from "lucide-react";
import AnimalPicker, { type AnimalOption } from "./AnimalPicker";
import AnimalMultiEntry from "./AnimalMultiEntry";
import AnimalPickerModal from "./AnimalPickerModal";
import QuestionPanel, { type QuestionTemplateData } from "./QuestionPanel";
import TraitementDraftRow, { type TraitementDraft } from "./TraitementDraftRow";
import { type MedicamentOption } from "./MedicamentPicker";
import { type Intervenant } from "./ExecutantSelect";
import { getMomentActuel } from "@/lib/evenements-sanitaires";
import { searchTypesEvenement, normalizeSearch, type RecherchableTypeEvenement } from "@/lib/fuzzy-search";
import { fileToResizedDataUrl } from "@/lib/image-client";
import { uploadEvenementPhoto } from "@/lib/firebase-client";
import PatteSelector from "@/components/PatteSelector";
import type { PatteParage } from "@/lib/parage";
import HoofPrintIcon from "@/components/HoofPrintIcon";
import { VOICE_SANITARY_STORAGE_KEY, type VoiceSanitaryDraft } from "@/lib/voice-sanitary";

interface Groupe {
  id: string;
  nom: string;
  _count: { animaux: number };
}

interface TypeSelectionne {
  id: string;
  nom: string;
}

type TargetMode = "animal" | "plusieurs";

const today = new Date().toISOString().slice(0, 10);

function nouveauDraft(): TraitementDraft {
  return { key: Math.random().toString(36).slice(2), medicament: null, voie: "", executant: "", dose: "", uniteDosage: "ml", motif: "" };
}

export default function NouvelEvenementForm({ presetNutrav, presetNutravs, presetMedicamentId }: { presetNutrav?: string; presetNutravs?: string[]; presetMedicamentId?: string }) {
  const router = useRouter();

  const [targetMode, setTargetMode] = useState<TargetMode>("animal");
  const [selectedAnimaux, setSelectedAnimaux] = useState<AnimalOption[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [showPickerModal, setShowPickerModal] = useState(false);

  const [date, setDate] = useState(today);
  const [moment, setMoment] = useState<"Matin" | "Soir">(getMomentActuel());

  const [catalogue, setCatalogue] = useState<RecherchableTypeEvenement[]>([]);
  const [recents, setRecents] = useState<{ libelle: string; typeEvenementId: string | null }[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<TypeSelectionne[]>([]);
  const [questionsByType, setQuestionsByType] = useState<Record<string, QuestionTemplateData[]>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [panelOuvert, setPanelOuvert] = useState<string | null>(null);
  const [ajoutLibreEnCours, setAjoutLibreEnCours] = useState(false);

  const [temperature, setTemperature] = useState("");
  const [ajouterAuParage, setAjouterAuParage] = useState(false);
  const [paragePattes, setParagePattes] = useState<PatteParage[]>([]);
  const [parageNote, setParageNote] = useState("");

  const [description, setDescription] = useState("");
  const [constatePar, setConstatePar] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [medicaments, setMedicaments] = useState<MedicamentOption[]>([]);
  const [intervenants, setIntervenants] = useState<Intervenant[]>([]);
  const [traitementActif, setTraitementActif] = useState(false);
  const [traitementsDrafts, setTraitementsDrafts] = useState<TraitementDraft[]>([nouveauDraft()]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ count: number; warning: string } | null>(null);
  const [error, setError] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceSanitaryDraft | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(VOICE_SANITARY_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(VOICE_SANITARY_STORAGE_KEY);
    try {
      const draft = JSON.parse(raw) as VoiceSanitaryDraft;
      if (!draft.target?.nutravs.length) return;
      setVoiceDraft(draft);
      setTargetMode(draft.target.nutravs.length > 1 ? "plusieurs" : "animal");
      setDate(draft.date || today);
      setMoment(draft.moment);
      setTemperature(draft.temperature !== null ? String(draft.temperature) : "");
      setAjouterAuParage(draft.ajouterAuParage);
      setParagePattes(draft.pattes);
      setDescription(draft.description);
    } catch {
      setError("Le brouillon vocal n’a pas pu être relu");
    }
  }, []);

  useEffect(() => {
    fetch("/api/groupes").then((r) => r.json()).then(setGroupes);
    fetch("/api/event-types").then((r) => r.json()).then(setCatalogue);
    fetch("/api/evenements/symptomes-recents").then((r) => r.json()).then(setRecents).catch(() => {});
    fetch("/api/medicaments").then((r) => r.json()).then((data: (MedicamentOption & { actif: boolean })[]) => setMedicaments(data.filter((m) => m.actif)));
    fetch("/api/intervenants").then((r) => r.json()).then(setIntervenants).catch(() => {});
  }, []);

  useEffect(() => {
    const nutravs = voiceDraft?.target?.nutravs?.length
      ? voiceDraft.target.nutravs
      : presetNutravs?.length
        ? presetNutravs
        : presetNutrav
          ? [presetNutrav]
          : [];
    if (nutravs.length === 0) return;

    fetch("/api/animaux/picker")
      .then((r) => r.json())
      .then((data: { id: string; nutrav: string; nobovi: string | null }[]) => {
        const demandes = new Set(nutravs);
        setSelectedAnimaux(
          data
            .filter((animal) => demandes.has(animal.nutrav))
            .map((animal) => ({ id: animal.id, nutrav: animal.nutrav, nom: animal.nobovi }))
        );
      });
  }, [presetNutrav, presetNutravs, voiceDraft]);

  useEffect(() => {
    const medicamentId = voiceDraft?.medicament?.id ?? presetMedicamentId;
    if (!medicamentId || medicaments.length === 0) return;
    const m = medicaments.find((med) => med.id === medicamentId);
    if (!m) return;
    setTraitementActif(true);
    setTraitementsDrafts((prev) => {
      if (prev.some((d) => d.medicament?.id === m.id)) return prev;
      const [first, ...rest] = prev;
      return [{ ...first, medicament: m, voie: voiceDraft?.voieAdministration ?? m.voie ?? first.voie }, ...rest];
    });
  }, [presetMedicamentId, medicaments, voiceDraft]);

  useEffect(() => {
    if (!voiceDraft?.event || catalogue.length === 0) return;
    const type = catalogue.find((item) => item.id === voiceDraft.event?.id);
    if (!type) return;
    setSelectedTypes((actuels) => actuels.some((item) => item.id === type.id) ? actuels : [...actuels, { id: type.id, nom: type.nom }]);
    if (!questionsByType[type.id]) {
      fetch(`/api/event-types/${type.id}/questions`)
        .then((response) => response.json())
        .then((questions: QuestionTemplateData[]) => setQuestionsByType((actuelles) => ({ ...actuelles, [type.id]: questions })))
        .catch(() => {});
    }
  }, [catalogue, voiceDraft, questionsByType]);

  const resultatsRecherche = useMemo(() => searchTypesEvenement(query, catalogue).slice(0, 8), [query, catalogue]);

  const suggestions = useMemo(() => {
    return recents
      .map((r) => {
        const type = r.typeEvenementId ? catalogue.find((c) => c.id === r.typeEvenementId) : undefined;
        return type ? { id: type.id, nom: type.nom } : { id: `libre-${r.libelle}`, nom: r.libelle };
      })
      .filter((t, i, arr) => arr.findIndex((x) => x.nom === t.nom) === i)
      .slice(0, 8);
  }, [recents, catalogue]);

  const aFievre = selectedTypes.some((t) => normalizeSearch(t.nom) === "fievre");
  const aBoiterie = selectedTypes.some((t) => t.id === "boiterie" || normalizeSearch(t.nom) === "boiterie");

  useEffect(() => {
    if (aBoiterie) return;
    setAjouterAuParage(false);
    setParagePattes([]);
    setParageNote("");
  }, [aBoiterie]);

  async function fetchQuestions(typeId: string) {
    if (questionsByType[typeId] || typeId.startsWith("libre-")) return;
    const res = await fetch(`/api/event-types/${typeId}/questions`);
    const data: QuestionTemplateData[] = await res.json();
    setQuestionsByType((prev) => ({ ...prev, [typeId]: data }));
  }

  function ajouterType(t: TypeSelectionne) {
    if (selectedTypes.some((s) => s.id === t.id)) return;
    setSelectedTypes((prev) => [...prev, t]);
    setQuery("");
    fetchQuestions(t.id);
  }

  function retirerType(id: string) {
    setSelectedTypes((prev) => prev.filter((t) => t.id !== id));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (panelOuvert === id) setPanelOuvert(null);
  }

  async function ajouterTypeLibre(nom: string) {
    const texte = nom.trim();
    if (!texte) return;
    setAjoutLibreEnCours(true);
    try {
      const res = await fetch("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: texte }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data._reused) setCatalogue((prev) => [...prev, { id: data.id, nom: data.nom, synonymes: null }]);
      ajouterType({ id: data.id, nom: data.nom });
    } finally {
      setAjoutLibreEnCours(false);
    }
  }

  function setAnswer(typeId: string, questionId: string, valeur: unknown) {
    setAnswers((prev) => ({
      ...prev,
      [typeId]: { ...(prev[typeId] ?? {}), [questionId]: valeur },
    }));
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoFile(file);
    const dataUrl = await fileToResizedDataUrl(file);
    setPhotoPreview(dataUrl);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  const draftsValides = traitementActif ? traitementsDrafts.filter((d) => d.medicament) : [];

  async function handleSubmit() {
    setError("");
    if (selectedTypes.length === 0) { setError("Sélectionne au moins un événement"); return; }
    if (!date) { setError("La date est requise"); return; }
    if (ajouterAuParage && paragePattes.length === 0) { setError("Sélectionne au moins une patte pour la liste de parage"); return; }

    const animaux = selectedAnimaux;
    if (animaux.length === 0) { setError("Sélectionne au moins un animal"); return; }

    if (traitementActif) {
      if (draftsValides.length === 0) { setError("Choisis au moins un médicament, ou désactive l'ajout de traitement"); return; }
      const incomplet = draftsValides.find((d) => !d.voie || !d.executant);
      if (incomplet) { setError(`Pour ${incomplet.medicament?.nom}, indique la voie d'administration et l'exécutant(e)`); return; }
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      let photoWarning = "";
      if (photoPreview) {
        try {
          const path = `evenements/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          photoUrl = await uploadEvenementPhoto(photoPreview, path);
        } catch {
          photoWarning = " (la photo n'a pas pu être envoyée, l'événement a été enregistré sans elle)";
        }
      }

      const premier = selectedTypes[0];
      const reponses: { questionId: string; valeur: string; libelleEnregistre: string }[] = [];
      for (const t of selectedTypes) {
        const qs = questionsByType[t.id] ?? [];
        const a = answers[t.id] ?? {};
        for (const q of qs) {
          const v = a[q.id];
          if (v === undefined || v === null || v === "") continue;
          reponses.push({ questionId: q.id, valeur: JSON.stringify(v), libelleEnregistre: q.label });
        }
      }

      const res = await fetch("/api/evenements/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalIds: animaux.map((a) => a.id),
          date,
          moment,
          type: premier.nom,
          symptomes: selectedTypes.map((t) => ({ libelle: t.nom, typeEvenementId: t.id.startsWith("libre-") ? null : t.id })),
          reponses,
          temperature: temperature !== "" ? Number(temperature) : null,
          description: description || null,
          photos: photoUrl,
          constatePar: constatePar || null,
          traitements: draftsValides.map((d) => ({
            medicamentId: d.medicament!.id,
            medicamentNom: d.medicament!.nom,
            voie: d.voie || null,
            executant: d.executant || null,
            dose: d.dose !== "" ? Number(d.dose) : null,
            uniteDosage: d.uniteDosage || null,
            motif: d.motif || null,
            delaiAttenteViandeJ: d.medicament!.delaiAttenteViandeJ ?? null,
            delaiAttenteLaitJ: d.medicament!.delaiAttenteLaitJ ?? null,
          })),
          parage: ajouterAuParage ? { motif: "BOITERIE", pattes: paragePattes, note: parageNote || null } : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erreur serveur");
      }
      const data = await res.json();
      setResult({ count: data.count, warning: photoWarning });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  function nouveauEvenement() {
    setResult(null);
    setSelectedTypes([]);
    setAnswers({});
    setPanelOuvert(null);
    setTemperature("");
    setAjouterAuParage(false);
    setParagePattes([]);
    setParageNote("");
    setDescription("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setTraitementActif(false);
    setTraitementsDrafts([nouveauDraft()]);
    if (!presetNutrav && !presetNutravs?.length) setSelectedAnimaux([]);
  }

  if (result) {
    return (
      <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
        <CheckCircle2 size={40} className="text-green-600 mx-auto" />
        <p className="font-semibold text-gray-800">
          Événement enregistré pour {result.count} animal{result.count > 1 ? "aux" : ""}
        </p>
        {result.warning && <p className="text-xs text-orange-600">{result.warning}</p>}

        <div className="flex gap-2 justify-center pt-2">
          <button onClick={nouveauEvenement} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Nouvel événement
          </button>
          <BackButton
            label="Retour"
            className="min-h-11 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {voiceDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 shadow-sm">
          <div className="flex items-center gap-2 font-semibold"><Mic size={16} /> Brouillon vocal à vérifier</div>
          <p className="mt-1 italic">« {voiceDraft.transcript} »</p>
          <p className="mt-1 text-xs text-amber-800">Toutes les informations restent modifiables. L’événement ne sera créé qu’avec le bouton Enregistrer.</p>
        </div>
      )}
      {showPickerModal && (
        <AnimalPickerModal
          selected={selectedAnimaux}
          onChange={setSelectedAnimaux}
          onClose={() => setShowPickerModal(false)}
          groupes={groupes.map((g) => ({ id: g.id, nom: g.nom }))}
        />
      )}

      {/* Animal(s) concerné(s) */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Animal(x) concerné(s)</h3>
        <div className="flex gap-2 mb-3">
          {([["animal", "Un animal"], ["plusieurs", "Plusieurs animaux"]] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTargetMode(mode)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                targetMode === mode ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {targetMode === "animal" && (
          <AnimalPicker selected={selectedAnimaux} onChange={setSelectedAnimaux} multiple={false} />
        )}

        {targetMode === "plusieurs" && (
          <div className="space-y-2">
            <AnimalMultiEntry selected={selectedAnimaux} onChange={setSelectedAnimaux} />
            <button
              type="button"
              onClick={() => setShowPickerModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <ListChecks size={13} /> Choisir dans le troupeau (par lot, sexe, catégorie…)
            </button>
            {selectedAnimaux.length > 0 && (
              <p className="text-xs text-gray-500">{selectedAnimaux.length} animal{selectedAnimaux.length > 1 ? "aux" : ""} sélectionné{selectedAnimaux.length > 1 ? "s" : ""}</p>
            )}
          </div>
        )}
      </div>

      {/* Date / moment */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Date et moment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Moment</label>
            <div className="flex gap-2">
              {(["Matin", "Soir"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoment(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    moment === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Que se passe-t-il ? */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Que se passe-t-il ?</h3>

        {selectedTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedTypes.map((t) => (
              <span key={t.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-2.5 pr-1 py-1 text-xs font-medium">
                {t.nom}
                <button type="button" onClick={() => retirerType(t.id)} className="hover:bg-blue-100 rounded-full p-0.5">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative mb-3">
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 mr-2 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && resultatsRecherche.length > 0) { e.preventDefault(); ajouterType({ id: resultatsRecherche[0].item.id, nom: resultatsRecherche[0].item.nom }); } }}
              placeholder="Rechercher un symptôme, une maladie, un soin ou une intervention…"
              className="w-full text-sm outline-none"
            />
          </div>
          {query.trim() && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-64 overflow-y-auto">
              {resultatsRecherche.map((r) => (
                <button
                  key={r.item.id}
                  type="button"
                  onClick={() => ajouterType({ id: r.item.id, nom: r.item.nom })}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {r.item.nom}
                </button>
              ))}
              {resultatsRecherche.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">Aucun résultat pour « {query} »</div>
              )}
              <button
                type="button"
                disabled={ajoutLibreEnCours}
                onClick={() => ajouterTypeLibre(query)}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 disabled:opacity-50"
              >
                {ajoutLibreEnCours ? "Ajout…" : `+ Ajouter « ${query.trim()} » comme nouvel événement`}
              </button>
            </div>
          )}
        </div>

        {!query.trim() && suggestions.length > 0 && (
          <div className="mb-1">
            <p className="text-xs text-gray-400 mb-1.5">Récemment utilisés</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.nom}
                  type="button"
                  onClick={() => ajouterType(s)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedTypes.some((t) => t.nom === s.nom) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {s.nom}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedTypes.length > 0 && (
          <div className="space-y-2 mt-3">
            {selectedTypes.map((t) => (
              <QuestionPanel
                key={t.id}
                typeNom={t.nom}
                questions={questionsByType[t.id] ?? []}
                answers={answers[t.id] ?? {}}
                onAnswerChange={(qId, v) => setAnswer(t.id, qId, v)}
                open={panelOuvert === t.id}
                onToggle={() => setPanelOuvert((prev) => (prev === t.id ? null : t.id))}
              />
            ))}
          </div>
        )}

        {aBoiterie && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50/50 p-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-green-900">
              <input
                type="checkbox"
                checked={ajouterAuParage}
                onChange={(event) => setAjouterAuParage(event.target.checked)}
                className="h-5 w-5 accent-green-700"
              />
              <HoofPrintIcon size={18} />
              Ajouter à la liste de parage
            </label>
            {ajouterAuParage && (
              <div className="mt-2 space-y-3 border-t border-green-200 pt-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-600">Patte(s) concernée(s)</span>
                  <PatteSelector value={paragePattes} onChange={setParagePattes} />
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Note pour le pareur (optionnelle)</span>
                  <textarea
                    value={parageNote}
                    onChange={(event) => setParageNote(event.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Observation complémentaire…"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div className="mt-3">
          <label className={`text-xs block mb-1 ${aFievre && !temperature ? "text-orange-600 font-medium" : "text-gray-500"}`}>
            <Thermometer size={12} className="inline mr-1 -mt-0.5" />
            Température {aFievre ? "(conseillé)" : "(optionnel)"}
          </label>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="°C"
            className={`w-32 border rounded-lg px-3 py-2 text-sm ${aFievre && !temperature ? "border-orange-300" : "border-gray-300"}`}
          />
        </div>
      </div>

      {/* Commentaire / photo / constaté par */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Commentaire (optionnel)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Observations, contexte…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Photo (optionnelle)</label>
          {photoPreview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Aperçu" className="h-28 rounded-lg border border-gray-200 object-cover" />
              <button type="button" onClick={removePhoto} className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <Camera size={15} /> Ajouter une photo
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoPick} />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Constaté par</label>
          <input
            value={constatePar}
            onChange={(e) => setConstatePar(e.target.value)}
            placeholder="Nom de la personne"
            list="constate-par-suggestions"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <datalist id="constate-par-suggestions">
            <option value="Samuel" />
            <option value="Céline" />
          </datalist>
        </div>
      </div>

      {/* Traitement (optionnel) */}
      <div className="bg-white rounded-xl shadow p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={traitementActif}
            onChange={(e) => setTraitementActif(e.target.checked)} className="w-4 h-4" />
          <span className="font-semibold text-gray-800 flex items-center gap-1.5">
            <Syringe size={15} className="text-blue-500" /> Ajouter un traitement
          </span>
        </label>

        {traitementActif && (
          <div className="mt-3 space-y-2.5">
            {traitementsDrafts.map((d) => (
              <TraitementDraftRow
                key={d.key}
                draft={d}
                medicaments={medicaments}
                intervenants={intervenants}
                removable={traitementsDrafts.length > 1}
                onChange={(next) => setTraitementsDrafts((prev) => prev.map((x) => (x.key === d.key ? next : x)))}
                onRemove={() => setTraitementsDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                onIntervenantAdded={(i) => setIntervenants((prev) => (prev.some((x) => x.id === i.id) ? prev : [...prev, i].sort((a, b) => a.nom.localeCompare(b.nom))))}
              />
            ))}
            <button type="button" onClick={() => setTraitementsDrafts((prev) => [...prev, nouveauDraft()])}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
              <Plus size={13} /> Ajouter un autre médicament
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        {submitting ? "Enregistrement…" : "Enregistrer l'événement"}
      </button>
    </div>
  );
}
