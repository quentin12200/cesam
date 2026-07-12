"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Trash2, UserPlus, Loader2 } from "lucide-react";
import { searchTypesEvenement, type RecherchableTypeEvenement } from "@/lib/fuzzy-search";
import QuestionPanel, { type QuestionTemplateData } from "@/app/sanitaire/nouvel-evenement/QuestionPanel";
import AnimalPickerModal from "@/app/sanitaire/nouvel-evenement/AnimalPickerModal";
import type { AnimalOption } from "@/app/sanitaire/nouvel-evenement/AnimalPicker";

interface SymptomeData {
  id: string;
  libelle: string;
  typeEvenementId: string | null;
}

interface ReponseData {
  questionId: string;
  valeur: string;
}

interface Props {
  evenementId: string;
  symptomes: SymptomeData[];
  reponses: ReponseData[];
  onClose: () => void;
  onChanged: () => void;
}

export default function EvenementEditPanel({ evenementId, symptomes, reponses, onClose, onChanged }: Props) {
  const [localSymptomes, setLocalSymptomes] = useState<SymptomeData[]>(symptomes);
  const [catalogue, setCatalogue] = useState<RecherchableTypeEvenement[]>([]);
  const [query, setQuery] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [questionsByType, setQuestionsByType] = useState<Record<string, QuestionTemplateData[]>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const r of reponses) {
      try { init[r.questionId] = JSON.parse(r.valeur); } catch { init[r.questionId] = r.valeur; }
    }
    return init;
  });
  const [panelOuvert, setPanelOuvert] = useState<string | null>(null);

  const [showAnimalPicker, setShowAnimalPicker] = useState(false);
  const [groupes, setGroupes] = useState<{ id: string; nom: string }[]>([]);
  const [dupliquerMsg, setDupliquerMsg] = useState("");
  const [suppression, setSuppression] = useState(false);

  useEffect(() => {
    fetch("/api/event-types").then((r) => r.json()).then(setCatalogue);
    fetch("/api/groupes").then((r) => r.json()).then((data: { id: string; nom: string }[]) => setGroupes(data));
    for (const s of symptomes) {
      if (s.typeEvenementId) chargerQuestions(s.typeEvenementId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chargerQuestions(typeId: string) {
    if (questionsByType[typeId]) return;
    const res = await fetch(`/api/event-types/${typeId}/questions`);
    const data: QuestionTemplateData[] = await res.json();
    setQuestionsByType((prev) => ({ ...prev, [typeId]: data }));
  }

  const resultats = useMemo(() => searchTypesEvenement(query, catalogue).slice(0, 6), [query, catalogue]);

  async function ajouterType(t: { id?: string; nom: string }) {
    if (t.id && localSymptomes.some((s) => s.typeEvenementId === t.id)) { setErreur("Déjà présent"); return; }
    setAjoutEnCours(true);
    setErreur("");
    try {
      const res = await fetch(`/api/evenements/${evenementId}/symptomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t.id ? { typeEvenementId: t.id } : { nom: t.nom }),
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.error ?? "Erreur"); return; }
      setLocalSymptomes((prev) => [...prev, data.symptome]);
      if (data.symptome.typeEvenementId && data.questions?.length) {
        setQuestionsByType((prev) => ({ ...prev, [data.symptome.typeEvenementId]: data.questions }));
      }
      setQuery("");
      onChanged();
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function retirerType(symptomeId: string) {
    setErreur("");
    const res = await fetch(`/api/evenements/${evenementId}/symptomes/${symptomeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setErreur(data.error ?? "Erreur"); return; }
    setLocalSymptomes((prev) => prev.filter((s) => s.id !== symptomeId));
    onChanged();
  }

  async function setAnswer(typeId: string, question: QuestionTemplateData, valeur: unknown) {
    setAnswers((prev) => ({ ...prev, [question.id]: valeur }));
    await fetch(`/api/evenements/${evenementId}/reponses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, valeur, libelleEnregistre: question.label }),
    });
    onChanged();
  }

  async function dupliquerVersAnimaux(animaux: AnimalOption[]) {
    if (animaux.length === 0) return;
    const res = await fetch(`/api/evenements/${evenementId}/dupliquer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animalIds: animaux.map((a) => a.id) }),
    });
    const data = await res.json();
    if (res.ok) {
      setDupliquerMsg(`Ajouté à ${data.count} animal(x)`);
      onChanged();
      setTimeout(() => setDupliquerMsg(""), 3000);
    }
  }

  async function supprimerEvenement() {
    if (!confirm("Retirer cet événement de cet animal ?")) return;
    setSuppression(true);
    try {
      await fetch(`/api/evenements/${evenementId}`, { method: "DELETE" });
      onChanged();
      onClose();
    } finally {
      setSuppression(false);
    }
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {localSymptomes.map((s) => (
          <span key={s.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-2.5 pr-1 py-1 text-xs font-medium">
            {s.libelle}
            <button type="button" onClick={() => retirerType(s.id)} className="hover:bg-blue-100 rounded-full p-0.5">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-lg px-2.5 py-1.5">
          <Search size={13} className="text-gray-400 mr-1.5 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ajouter un autre événement…"
            className="w-full text-xs outline-none"
          />
          {ajoutEnCours && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </div>
        {query.trim() && (
          <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-10 max-h-48 overflow-y-auto">
            {resultats.map((r) => (
              <button key={r.item.id} type="button" onClick={() => ajouterType({ id: r.item.id, nom: r.item.nom })}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">
                {r.item.nom}
              </button>
            ))}
            <button type="button" onClick={() => ajouterType({ nom: query })}
              className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100">
              + Ajouter « {query.trim()} »
            </button>
          </div>
        )}
      </div>

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}

      {localSymptomes.filter((s) => s.typeEvenementId && (questionsByType[s.typeEvenementId]?.length ?? 0) > 0).map((s) => (
        <QuestionPanel
          key={s.id}
          typeNom={s.libelle}
          questions={questionsByType[s.typeEvenementId!] ?? []}
          answers={answers}
          onAnswerChange={(qId, v) => {
            const q = questionsByType[s.typeEvenementId!]?.find((x) => x.id === qId);
            if (q) setAnswer(s.typeEvenementId!, q, v);
          }}
          open={panelOuvert === s.id}
          onToggle={() => setPanelOuvert((prev) => (prev === s.id ? null : s.id))}
        />
      ))}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setShowAnimalPicker(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <UserPlus size={13} /> Ajouter à d&apos;autres animaux
        </button>
        <button type="button" onClick={supprimerEvenement} disabled={suppression}
          className="flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50">
          <Trash2 size={13} /> Retirer cet animal
        </button>
      </div>
      {dupliquerMsg && <p className="text-xs text-green-600">{dupliquerMsg}</p>}

      <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
        Fermer l&apos;édition
      </button>

      {showAnimalPicker && (
        <AnimalPickerModal
          selected={[]}
          onChange={dupliquerVersAnimaux}
          onClose={() => setShowAnimalPicker(false)}
          groupes={groupes}
        />
      )}
    </div>
  );
}
