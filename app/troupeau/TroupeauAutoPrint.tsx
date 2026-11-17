"use client";

import { useEffect } from "react";

/** Déclenche l'impression du tableau déjà rendu avec ses filtres et son tri. */
export default function TroupeauAutoPrint() {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return null;
}
