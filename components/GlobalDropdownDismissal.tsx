"use client";

import { useEffect } from "react";

function fermer(details: HTMLDetailsElement) {
  details.removeAttribute("open");
}

export default function GlobalDropdownDismissal() {
  useEffect(() => {
    function fermerHorsMenu(event: PointerEvent) {
      const cible = event.target as Node;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (!details.contains(cible)) fermer(details);
      });
    }

    function fermerSurEchap(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(fermer);
    }

    function garderUnSeulMenu(event: Event) {
      const ouvert = event.target;
      if (!(ouvert instanceof HTMLDetailsElement) || !ouvert.open) return;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        const memeArbre = details === ouvert || details.contains(ouvert) || ouvert.contains(details);
        if (!memeArbre) fermer(details);
      });
    }

    document.addEventListener("pointerdown", fermerHorsMenu);
    document.addEventListener("toggle", garderUnSeulMenu, true);
    window.addEventListener("keydown", fermerSurEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerHorsMenu);
      document.removeEventListener("toggle", garderUnSeulMenu, true);
      window.removeEventListener("keydown", fermerSurEchap);
    };
  }, []);

  return null;
}
