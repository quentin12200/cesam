"use client";

import { useRouter } from "next/navigation";
import RecordActionsMenu from "@/components/RecordActionsMenu";

interface Props {
  url: string;
  confirmMessage?: string;
  onDeleted?: () => void;
}

export default function ConfirmDeleteButton({
  url,
  confirmMessage = "Confirmer la suppression de cet événement ?",
  onDeleted,
}: Props) {
  const router = useRouter();

  async function handleDelete() {
    await fetch(url, { method: "DELETE" });
    onDeleted?.();
    router.refresh();
  }

  return (
    <RecordActionsMenu actions={[{
      label: "Supprimer la saisie",
      tone: "danger",
      confirmMessage,
      onSelect: handleDelete,
    }]} />
  );
}
