"use client";

import { Printer } from "lucide-react";

// Laisse le navigateur peindre les nouvelles règles CSS (classe + attribut
// posés juste avant) avant de déclencher l'impression : sur certains
// navigateurs mobiles, appeler print() dans la foulée capture encore l'état
// précédent de la mise en page (aperçu vide ou page entière).
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export default function PrintSectionButton({
  sectionId,
  label,
  className = "",
  beforePrint,
}: {
  sectionId: string;
  label?: string;
  className?: string;
  /** Appelé avant l'impression (ex: déplier une section repliée). Si elle
   * retourne une Promise, l'impression attend qu'elle se résolve. */
  beforePrint?: () => void | Promise<void>;
}) {
  async function handlePrint(e: React.MouseEvent) {
    e.stopPropagation();
    if (beforePrint) await beforePrint();

    document.querySelectorAll("[data-print-section]").forEach((el) => el.removeAttribute("data-print-active"));
    document.getElementById(sectionId)?.setAttribute("data-print-active", "true");
    document.body.classList.add("printing-single-section");

    await nextPaint();

    const cleanup = () => {
      document.body.classList.remove("printing-single-section");
      document.getElementById(sectionId)?.removeAttribute("data-print-active");
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Filet de sécurité : "afterprint" n'est pas toujours déclenché de façon
    // fiable sur les navigateurs mobiles (notamment en PWA installée).
    setTimeout(cleanup, 3000);
  }

  return (
    <button
      onClick={handlePrint}
      title={label ? `Imprimer ${label}` : "Imprimer cette section"}
      aria-label={label ? `Imprimer ${label}` : "Imprimer cette section"}
      className={`print:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ${className}`}
    >
      <Printer size={15} />
    </button>
  );
}
