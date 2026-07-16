"use client";

import { useRouter } from "next/navigation";
import RecordActionsMenu from "@/components/RecordActionsMenu";

interface Props {
  endpoint: string;
  label?: string;
  confirmLabel?: string;
}

export default function DeleteHistoriqueButton({
  endpoint,
  label = "🗑 Supprimer",
  confirmLabel = "Supprimer ?",
}: Props) {
  const router = useRouter();

  async function handleDelete() {
    const res = await fetch(endpoint, { method: "DELETE" });
    if (!res.ok) throw new Error("Suppression impossible");
    router.refresh();
  }

  return (
    <RecordActionsMenu actions={[{
      label: label.replace(/^🗑\s*/, ""),
      tone: "danger",
      confirmMessage: confirmLabel,
      onSelect: handleDelete,
    }]} />
  );
}
