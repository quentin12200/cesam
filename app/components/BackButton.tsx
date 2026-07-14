"use client";

import type { ButtonHTMLAttributes } from "react";
import { ArrowLeft } from "lucide-react";

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
    sessionStorage.setItem("cesam:restore-scroll", "1");

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
