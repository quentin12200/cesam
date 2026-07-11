"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, Loader2, CheckCircle2, ChevronLeft, Search } from "lucide-react";
import AnimalPicker, { type AnimalOption } from "./AnimalPicker";
import { CATEGORIES_EVENEMENT, getMomentActuel, type CategorieEvenementId } from "@/lib/evenements-sanitaires";
import { fileToResizedDataUrl } from "@/lib/image-client";
import { uploadEvenementPhoto } from "@/lib/firebase-client";

interface Groupe {
  id: string;
  nom: string;
  _count: { animaux: number };
}

type TargetMode = "animal" | "plusieurs" | "lot";

const today = new Date().toISOString().slice(0, 10);

export default function NouvelEvenementForm({ presetNutrav }: { presetNutrav?: string }) {
  const router = useRouter();

  const [targetMode, setTargetMode] = useState<TargetMode>("animal");
  const [selectedAnimaux, setSelectedAnimaux] = useState<AnimalOption[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [selectedGroupeId, setSelectedGroupeId] = useState("");

  const [date, setDate] = useState(today);
  const [moment, setMoment] = useState<"Matin" | "Soir">(getMomentActuel());

  const [categorie, setCategorie] = useState<CategorieEvenementId | null>(null);
  const [type, setType] = useState("");
  const [autreOuvert, setAutreOuvert] = useState(false);
  const [autreTexte, setAutreTexte] = useState("");
  const [rechercheType, setRechercheType] = useState("");

  const [description, setDescription] = useState("");
  const [constatePar, setConstatePar] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ count: number; warning: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groupes").then((r) => r.json()).then(setGroupes);
  }, []);

  useEffect(() => {
    if (!presetNutrav) return;
    fetch(`/api/search?q=${encodeURIComponent(presetNutrav)}`)
      .then((r) => r.json())
      .then((data: { id: string; nutrav: string; nom: string | null }[]) => {
        const exact = data.find((a) => a.nutrav === presetNutrav) ?? data[0];
        if (exact) setSelectedAnimaux([{ id: exact.id, nutrav: exact.nutrav, nom: exact.nom }]);
      });
  }, [presetNutrav]);

  const evenementsAplatis = useMemo(
    () => CATEGORIES_EVENEMENT.flatMap((c) => c.evenements.map((e) => ({ evenement: e, categorie: c }))),
    []
  );

  const resultatsRecherche = useMemo(() => {
    const q = rechercheType.trim().toLowerCase();
    if (!q) return [];
    return evenementsAplatis.filter((r) => r.evenement.toLowerCase().includes(q));
  }, [rechercheType, evenementsAplatis]);

  const categorieActive = CATEGORIES_EVENEMENT.find((c) => c.id === categorie);

  function choisirType(nom: string, cat: CategorieEvenementId) {
    setType(nom);
    setCategorie(cat);
    setAutreOuvert(false);
    setRechercheType("");
  }

  function validerAutre() {
    if (!autreTexte.trim()) return;
    setType(autreTexte.trim());
    setCategorie(categorie ?? "AUTRE");
    setAutreOuvert(false);
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

  const resolveAnimalIds = useCallback(async (): Promise<string[]> => {
    if (targetMode === "lot") {
      if (!selectedGroupeId) return [];
      const res = await fetch(`/api/animaux?groupeId=${selectedGroupeId}&limit=1000`);
      const data = await res.json();
      return (data.animaux ?? []).map((a: { id: string }) => a.id);
    }
    return selectedAnimaux.map((a) => a.id);
  }, [targetMode, selectedGroupeId, selectedAnimaux]);

  async function handleSubmit() {
    setError("");
    if (!type.trim()) { setError("Choisis un type d'événement"); return; }
    if (!date) { setError("La date est requise"); return; }

    const animalIds = await resolveAnimalIds();
    if (animalIds.length === 0) { setError("Sélectionne au moins un animal"); return; }

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

      const res = await fetch("/api/evenements/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalIds,
          date,
          moment,
          categorie,
          type: type.trim(),
          description: description || null,
          photos: photoUrl,
          constatePar: constatePar || null,
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
    setType("");
    setCategorie(null);
    setDescription("");
    setPhotoFile(null);
    setPhotoPreview(null);
    if (!presetNutrav) setSelectedAnimaux([]);
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
          <button onClick={() => router.push("/sanitaire")} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            Retour au module sanitaire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Animal(s) concerné(s) */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Animal(x) concerné(s)</h3>
        <div className="flex gap-2 mb-3">
          {([["animal", "Un animal"], ["plusieurs", "Plusieurs animaux"], ["lot", "Un lot"]] as const).map(([mode, label]) => (
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

        {targetMode !== "lot" ? (
          <AnimalPicker selected={selectedAnimaux} onChange={setSelectedAnimaux} multiple={targetMode === "plusieurs"} />
        ) : (
          <select
            value={selectedGroupeId}
            onChange={(e) => setSelectedGroupeId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— Choisir un lot —</option>
            {groupes.map((g) => (
              <option key={g.id} value={g.id}>{g.nom} ({g._count.animaux} animal{g._count.animaux > 1 ? "aux" : ""})</option>
            ))}
          </select>
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

      {/* Type d'événement */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Type d&apos;événement</h3>

        {type && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            <span className="text-sm font-medium text-blue-800">{type}</span>
            <button type="button" onClick={() => { setType(""); setCategorie(null); }} className="text-blue-600 text-xs hover:underline">
              Changer
            </button>
          </div>
        )}

        <div className="relative mb-3">
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 mr-2 shrink-0" />
            <input
              value={rechercheType}
              onChange={(e) => setRechercheType(e.target.value)}
              placeholder="Rechercher un événement…"
              className="w-full text-sm outline-none"
            />
          </div>
          {resultatsRecherche.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-56 overflow-y-auto">
              {resultatsRecherche.map((r) => (
                <button
                  key={r.evenement}
                  type="button"
                  onClick={() => choisirType(r.evenement, r.categorie.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{r.evenement}</span>
                  <span className="text-xs text-gray-400">{r.categorie.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!rechercheType && !categorieActive && (
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES_EVENEMENT.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorie(c.id)}
                className="text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-gray-700"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {!rechercheType && categorieActive && (
          <div>
            <button type="button" onClick={() => setCategorie(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2">
              <ChevronLeft size={14} /> Catégories
            </button>
            <p className="text-xs text-gray-400 mb-2">{categorieActive.label}</p>
            <div className="flex flex-wrap gap-2">
              {categorieActive.evenements.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => choisirType(e, categorieActive.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    type === e ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAutreOuvert(true)}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-400 text-gray-600 hover:border-blue-400"
              >
                Autre (préciser)…
              </button>
            </div>
          </div>
        )}

        {autreOuvert && (
          <div className="flex gap-2 mt-3">
            <input
              value={autreTexte}
              onChange={(e) => setAutreTexte(e.target.value)}
              placeholder="Intitulé de l'événement"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button type="button" onClick={validerAutre} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              OK
            </button>
          </div>
        )}
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
