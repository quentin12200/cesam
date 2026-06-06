"use client";

import { useEffect } from "react";

const SCROLL_KEY = "repro:scrollY";

export default function ReproScrollRestorer() {
  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      sessionStorage.removeItem(SCROLL_KEY);
      const y = parseInt(saved, 10);
      const id = setTimeout(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), 200);
      return () => clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (/^\/troupeau\/[^/]+$/.test(href)) {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      }
    }
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return null;
}
