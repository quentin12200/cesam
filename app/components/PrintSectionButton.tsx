"use client";

import { Printer } from "lucide-react";

// Laisse le navigateur peindre les changements avant de déclencher
// l'impression (certains navigateurs mobiles capturent sinon l'état
// précédent de la mise en page).
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

    const container = document.querySelector(".dashboard-content");
    const target = document.getElementById(sectionId);
    if (!container || !target) return;

    // Le moteur d'impression de certains navigateurs mobiles (Android/Chrome
    // en PWA installée notamment) n'applique pas les règles @media print :
    // on masque donc directement les autres éléments via style.display,
    // ce qui s'applique quel que soit le mode d'impression utilisé.
    const hidden: { el: HTMLElement; prevDisplay: string }[] = [];
    const hide = (el: HTMLElement) => {
      hidden.push({ el, prevDisplay: el.style.display });
      el.style.display = "none";
    };

    Array.from(container.children).forEach((child) => {
      if (child !== target) hide(child as HTMLElement);
    });
    document.querySelectorAll("header, .app-print-btn").forEach((el) => hide(el as HTMLElement));

    await nextPaint();

    const restore = () => {
      hidden.forEach(({ el, prevDisplay }) => {
        el.style.display = prevDisplay;
      });
    };
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
    // Filet de sécurité seulement (au cas où "afterprint" ne se déclenche
    // jamais) : sur mobile, window.print() ne bloque pas l'exécution du JS et
    // la génération de l'aperçu peut prendre plusieurs secondes — un délai
    // trop court ici réaffiche tout AVANT que l'aperçu ne soit capturé.
    setTimeout(restore, 120000);
  }

  return (
    <button
      onClick={handlePrint}
      title={label ? `Imprimer ${label}` : "Imprimer cette section"}
      aria-label={label ? `Imprimer ${label}` : "Imprimer cette section"}
      className={`app-print-btn p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ${className}`}
    >
      <Printer size={15} />
    </button>
  );
}
