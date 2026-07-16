"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

interface SelectionModalProps {
  title: string;
  onClose: () => void;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export default function SelectionModal({
  title,
  onClose,
  controls,
  children,
  footer,
  maxWidth = "lg",
}: SelectionModalProps) {
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex h-[100dvh] items-center justify-center overflow-hidden p-3 overscroll-none">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-[min(42rem,calc(100dvh-1.5rem))] min-h-0 w-full ${WIDTHS[maxWidth]} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id={titleId} className="font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X size={19} />
          </button>
        </header>

        {controls && <div className="shrink-0 border-b border-gray-100">{controls}</div>}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && <footer className="shrink-0 border-t border-gray-100">{footer}</footer>}
      </section>
    </div>
  );
}
