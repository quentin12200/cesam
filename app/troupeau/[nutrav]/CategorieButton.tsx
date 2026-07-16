"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import SelectionModal from "@/components/SelectionModal";
import {
  getCategorieLabel,
  getCategorieColor,
  getCategoriesDisponibles,
  CATEGORIES_LABELS,
  type CategorieAnimal,
} from "@/lib/utils";

interface Props {
  nutrav: string;
  sexbov: string;
  danais: string;
  estGenisse: boolean;
  categorie: string | null;
}

export default function CategorieButton({ nutrav, sexbov, danais, estGenisse, categorie }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cats = getCategoriesDisponibles(sexbov);
  const currentLabel = getCategorieLabel(sexbov, new Date(danais), estGenisse, categorie);
  const currentCat = (categorie as CategorieAnimal | null) ?? null;

  async function changeCategorie(newCat: CategorieAnimal | null) {
    setSaving(true);
    try {
      await fetch(`/api/animaux/${nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie: newCat }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors shadow-sm"
      >
        <Tag size={12} />
        Changer catégorie
      </button>

      {open && (
        <SelectionModal title="Changer la catégorie" onClose={() => setOpen(false)} maxWidth="sm">
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3">
              Catégorie actuelle : <strong>{currentLabel}</strong>
              {!categorie && <span className="ml-1 text-gray-400">(automatique)</span>}
            </p>
            <div className="space-y-2">
              {categorie && (
                <button
                  onClick={() => changeCategorie(null)}
                  disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 transition-colors"
                >
                  Réinitialiser (automatique)
                </button>
              )}
              {cats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => changeCategorie(cat)}
                  disabled={saving || cat === currentCat}
                  className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    cat === currentCat
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white"
                  }`}
                >
                  {sexbov === "F" ? "♀" : "♂"} {CATEGORIES_LABELS[cat]}
                  {cat === currentCat && <span className="ml-2 text-green-600 text-xs">✓ Actuelle</span>}
                </button>
              ))}
            </div>
          </div>
        </SelectionModal>
      )}
    </>
  );
}
