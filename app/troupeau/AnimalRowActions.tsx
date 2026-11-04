"use client";

import { useRouter } from "next/navigation";
import RecordActionsMenu from "@/components/RecordActionsMenu";

export default function AnimalRowActions({ nutrav }: { nutrav: string }) {
  const router = useRouter();
  return (
    <RecordActionsMenu
      actions={[
        { label: "Modifier la fiche (nom, date, etc.)", onSelect: () => router.push(`/troupeau/${encodeURIComponent(nutrav)}?edit=1`) },
        { label: "Modifier le père", onSelect: () => router.push(`/troupeau/${encodeURIComponent(nutrav)}/arbre?edit=pere`) },
        { label: "Voir / corriger la généalogie", onSelect: () => router.push(`/troupeau/${encodeURIComponent(nutrav)}/arbre`) },
      ]}
      className="justify-end"
    />
  );
}
