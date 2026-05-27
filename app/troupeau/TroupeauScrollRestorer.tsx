"use client";

import { useEffect } from "react";

const SCROLL_KEY = "troupeau:scrollY";
const URL_KEY = "troupeau:lastUrl";

export default function TroupeauScrollRestorer() {
  useEffect(() => {
    // Save current URL so BottomNav can restore it
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem(URL_KEY, currentUrl);

    // Restore scroll position if coming back from a detail page
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    if (savedScroll) {
      sessionStorage.removeItem(SCROLL_KEY);
      const y = parseInt(savedScroll, 10);
      // Defer to let the DOM render first
      const id = setTimeout(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), 80);
      return () => clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    // Intercept clicks on animal detail links to save scroll position
    function handleClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      // Only save when navigating to a detail page from troupeau list
      if (/^\/troupeau\/[^/]+$/.test(href)) {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      }
    }
    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return null;
}
