"use client";

import { Printer } from "lucide-react";

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
  function handlePrint(e: React.MouseEvent) {
    e.stopPropagation();
    // Ouvre la fenêtre d'impression tout de suite (de façon synchrone, dans le
    // même geste utilisateur) : certains navigateurs mobiles bloquent le popup
    // si window.open() est appelé après un await.
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    (async () => {
      if (beforePrint) await beforePrint();

      const el = document.getElementById(sectionId);
      if (!el) {
        printWindow.close();
        return;
      }

      // Se contenter d'un @media print + display:none sur le reste de la page
      // ne suffit pas de façon fiable sur tous les navigateurs mobiles : on
      // isole donc le contenu de la section dans un document à part, avec les
      // mêmes feuilles de style, pour n'imprimer que ça, quel que soit l'appareil.
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((node) => node.outerHTML)
        .join("\n");

      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${label ?? "Impression"}</title>
${styles}
<style>body { padding: 16px; background: #fff; }</style>
</head>
<body>${el.outerHTML}</body>
</html>`);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      printWindow.onafterprint = () => printWindow.close();
    })();
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
