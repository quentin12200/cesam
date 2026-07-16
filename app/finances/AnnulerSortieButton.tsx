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
    await fetch(`/api/sorties/${sortieId}`, { method: "DELETE" });
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

