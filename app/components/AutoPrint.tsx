"use client";

import { useEffect } from "react";

/** Déclenche l'impression au chargement d'une page qui ne contient déjà
 * que le contenu à imprimer — plus fiable sur mobile que de masquer des
 * éléments juste avant d'imprimer sur la page normale. */
export default function AutoPrint() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);

  return null;
}
