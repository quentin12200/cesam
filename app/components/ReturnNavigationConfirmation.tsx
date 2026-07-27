"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ORIGIN_CONFIRMATION_KEY } from "@/lib/origin-navigation";

export default function ReturnNavigationConfirmation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(ORIGIN_CONFIRMATION_KEY);
    if (!stored) return;
    window.sessionStorage.removeItem(ORIGIN_CONFIRMATION_KEY);
    setMessage(stored);
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white shadow-lg sm:bottom-6"
    >
      {message}
    </div>
  );
}
