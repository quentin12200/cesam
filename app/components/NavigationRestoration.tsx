"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function pageKey() {
  return `cesam:scroll:${window.location.pathname}${window.location.search}`;
}

function scrollContainer() {
  return document.querySelector("main");
}

function currentPosition() {
  const main = scrollContainer();
  return Math.max(window.scrollY, main?.scrollTop ?? 0);
}

function restorePosition(position: number) {
  window.scrollTo({ top: position, behavior: "auto" });
  const main = scrollContainer();
  if (main) main.scrollTop = position;
}

export default function NavigationRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    const markReturn = () => sessionStorage.setItem("cesam:restore-scroll", "1");
    window.addEventListener("popstate", markReturn);
    return () => window.removeEventListener("popstate", markReturn);
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const key = pageKey();

    const save = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        sessionStorage.setItem(key, String(currentPosition()));
      });
    };

    window.addEventListener("scroll", save, { passive: true });
    scrollContainer()?.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);

    if (sessionStorage.getItem("cesam:restore-scroll") === "1") {
      sessionStorage.removeItem("cesam:restore-scroll");
      const saved = Number(sessionStorage.getItem(key) ?? "0");
      requestAnimationFrame(() => requestAnimationFrame(() => restorePosition(saved)));
    }

    return () => {
      save();
      window.removeEventListener("scroll", save);
      scrollContainer()?.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
