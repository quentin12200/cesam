"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ORIGIN_CONFIRMATION_KEY,
  SCROLL_RESTORE_KEY,
  safeReturnTo,
  withReturnTo,
} from "@/lib/origin-navigation";

export function useOriginNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUrl, setCurrentUrl] = useState(pathname);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    setReturnTo(safeReturnTo(new URLSearchParams(window.location.search).get("returnTo")));
  }, [pathname]);

  function markScrollRestoration() {
    window.sessionStorage.setItem(SCROLL_RESTORE_KEY, "1");
  }

  function hrefWithOrigin(href: string) {
    return withReturnTo(href, currentUrl);
  }

  function closeToOrigin(fallback?: string) {
    const target = returnTo ?? fallback ?? null;
    if (!target) return false;
    markScrollRestoration();
    router.push(target);
    return true;
  }

  function completeToOrigin(message: string, fallback?: string) {
    const target = returnTo ?? fallback ?? null;
    if (!target) return false;
    window.sessionStorage.setItem(ORIGIN_CONFIRMATION_KEY, message);
    markScrollRestoration();
    window.location.assign(target);
    return true;
  }

  return {
    currentUrl,
    returnTo,
    hrefWithOrigin,
    closeToOrigin,
    completeToOrigin,
  };
}
