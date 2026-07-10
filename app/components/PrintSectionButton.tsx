import Link from "next/link";
import { Printer } from "lucide-react";

/** Lien vers une page dédiée ne contenant que cette section (voir
 * app/page.tsx, mode ?imprimer=<printKey>), qui déclenche l'impression
 * automatiquement à son chargement. Masquer des éléments juste avant
 * d'imprimer sur la page normale s'est révélé peu fiable sur mobile : le
 * moteur d'impression semble parfois capturer un rendu déconnecté de l'état
 * JS courant. Une vraie page dédiée, servie par le serveur, n'a par
 * construction rien d'autre à masquer. */
export default function PrintSectionButton({
  printKey,
  className = "",
}: {
  printKey: string;
  className?: string;
}) {
  return (
    <Link
      href={`/?imprimer=${printKey}`}
      title="Imprimer cette section"
      aria-label="Imprimer cette section"
      className={`print:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ${className}`}
    >
      <Printer size={15} />
    </Link>
  );
}
