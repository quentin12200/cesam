"use client";

import { useRouter } from "next/navigation";
import RecordActionsMenu from "@/components/RecordActionsMenu";

export default function AnnulerSortieButton({
  sortieId,
  nutrav,
}: {
  sortieId: string;
  nutrav: string;
}) {
  const router = useRouter();
  async function handleDelete() {
    const res = await fetch(`/api/sorties/${sortieId}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json()).error ?? "Annulation impossible");
    router.refresh();
  }

  return (
    <RecordActionsMenu actions={[{
      label: "Supprimer la sortie",
      tone: "danger",
      confirmMessage: `Supprimer la sortie de l'animal ${nutrav} ? L'animal redeviendra actif.`,
      onSelect: handleDelete,
    }]} />
  );
}

