"use client";

import { ChevronDown } from "lucide-react";

export interface QuestionTemplateData {
  id: string;
  label: string;
  type: string;
  options: string[] | null;
  unite: string | null;
  obligatoire: boolean;
  ordre: number;
}

interface Props {
  typeNom: string;
  questions: QuestionTemplateData[];
  answers: Record<string, unknown>;
  onAnswerChange: (questionId: string, valeur: unknown) => void;
  open: boolean;
  onToggle: () => void;
}

export default function QuestionPanel({ typeNom, questions, answers, onAnswerChange, open, onToggle }: Props) {
  if (questions.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100"
      >
        <span>Préciser {typeNom}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {[...questions].sort((a, b) => a.ordre - b.ordre).map((q) => (
            <QuestionField key={q.id} question={q} valeur={answers[q.id]} onChange={(v) => onAnswerChange(q.id, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionField({ question, valeur, onChange }: { question: QuestionTemplateData; valeur: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <label className="text-xs text-gray-500 block mb-1">
      {question.label}
      {question.unite ? ` (${question.unite})` : ""}
    </label>
  );

  switch (question.type) {
    case "CHOIX_UNIQUE":
    case "ANATOMIE":
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-1.5">
            {(question.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(valeur === opt ? undefined : opt)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  valeur === opt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case "CHOIX_MULTIPLE": {
      const arr = Array.isArray(valeur) ? (valeur as string[]) : [];
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-1.5">
            {(question.options ?? []).map((opt) => {
              const active = arr.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(active ? arr.filter((v) => v !== opt) : [...arr, opt])}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "OUI_NON":
      return (
        <div>
          {label}
          <div className="flex gap-2">
            {(["Oui", "Non"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(valeur === (opt === "Oui") ? undefined : opt === "Oui")}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  valeur === (opt === "Oui") ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case "NOMBRE_ENTIER":
      return (
        <div>
          {label}
          <input
            type="number" step={1} value={typeof valeur === "number" ? valeur : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      );

    case "NOMBRE_DECIMAL":
    case "VALEUR_UNITE":
      return (
        <div>
          {label}
          <input
            type="number" step={0.1} value={typeof valeur === "number" ? valeur : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      );

    case "COMMENTAIRE":
      return (
        <div>
          {label}
          <textarea
            value={typeof valeur === "string" ? valeur : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none"
          />
        </div>
      );

    case "TEXTE_COURT":
    default:
      return (
        <div>
          {label}
          <input
            type="text" value={typeof valeur === "string" ? valeur : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      );
  }
}
