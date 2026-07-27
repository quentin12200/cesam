"use client";

import type { ButtonHTMLAttributes } from "react";
import { ArrowLeft } from "lucide-react";
import { safeReturnTo, SCROLL_RESTORE_KEY } from "@/lib/origin-navigation";

interface BackButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  label?: string;
  iconSize?: number;
}

export default function BackButton({
  label,
  iconSize = 18,
  className = "p-2 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50",
  ...props
}: BackButtonProps) {
  function handleBack() {
    sessionStorage.setItem(SCROLL_RESTORE_KEY, "1");
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    if (returnTo) {
      window.location.assign(returnTo);
      return;
    }

    if (window.opener && window.history.length <= 1) {
      window.close();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  }

  return (
    <button
      {...props}
      type="button"
      onClick={handleBack}
      className={className}
      aria-label={props["aria-label"] ?? (label ? undefined : "Retour à la page précédente")}
      title={props.title ?? "Retour à la page précédente"}
    >
      <ArrowLeft size={iconSize} />
      {label && <span>{label}</span>}
    </button>
  );
}
