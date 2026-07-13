"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

interface Props {
  url: string;
  confirmMessage?: string;
  className?: string;
  iconSize?: number;
  onDeleted?: () => void;
}

export default function ConfirmDeleteButton({
  url,
  confirmMessage = "Confirmer la suppression de cet événement ?",
  className,
  iconSize = 14,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    try {
      await fetch(url, { method: "DELETE" });
      onDeleted?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Supprimer"
      className={className ?? "shrink-0 p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"}
    >
      {busy ? <Loader2 size={iconSize} className="animate-spin" /> : <X size={iconSize} />}
    </button>
  );
}
