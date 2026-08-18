"use client";

import { useRouter } from "next/navigation";
import SortieEditorModal, { type SortieEditorValues } from "@/app/finances/SortieEditorModal";

type Animal = { id: string; nutrav: string; nobovi: string | null; sexbov: string; categorie: string | null; poidsVif: number | null };

export default function SimulationSaleForm({ simulationId, animals, priceKg, animalPrices }: { simulationId: string; animals: Animal[]; priceKg: number | null; animalPrices: Record<string, number | null> }) {
  const router = useRouter();
  async function submit(values: SortieEditorValues) {
    const type = values.modeVente === "VIF" ? "ELEVAGE" : "BOUCHERIE";
    const poids = values.modeVente === "VIF" ? values.poidsVifVente : values.poidsCarcasse;
    const prixKilo = values.modeVente === "VIF" ? values.prixKgVif : values.prixKgCarcasse;
    const response = await fetch("/api/sorties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, type, poids, prixKilo, animalPrices, simulationId }) });
    if (!response.ok) throw new Error((await response.json()).error ?? "La vente ne peut pas être enregistrée.");
    router.push("/troupeau/simulations-vente");
    router.refresh();
  }
  return <SortieEditorModal
    title="Confirmer la vente"
    animals={animals}
    initialAnimalIds={animals.map((animal) => animal.id)}
    submitLabel="Confirmer la vente groupée"
    initial={{ animalId: animals[0]?.id, date: new Date().toISOString().slice(0, 10), nature: "VENTE", modeVente: "VIF", prixKgVif: priceKg }}
    onClose={() => router.push(`/troupeau/simulations-vente/${simulationId}`)}
    onSubmit={submit}
  />;
}
