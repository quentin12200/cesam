"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FIELD_SESSION_STORAGE_KEY,
  parseStoredFieldSession,
} from "@/lib/field-weighing-session";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatWeighingSessionDate(startedAt: string, now: Date = new Date()) {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return "";

  const daysAgo = Math.max(
    0,
    Math.round(
      (startOfLocalDay(now).getTime() - startOfLocalDay(started).getTime()) / DAY_MS,
    ),
  );
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(started);
  const ageLabel = daysAgo === 0
    ? "aujourd’hui"
    : daysAgo === 1
      ? "hier"
      : `il y a ${daysAgo} jours`;

  return `Pesée du ${dateLabel} · ${ageLabel}`;
}

export default function WeighingSessionDate() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let portalHost: HTMLElement | null = null;
    let createdHost = false;

    function refreshLabel() {
      const rawSession = localStorage.getItem(FIELD_SESSION_STORAGE_KEY);
      if (!rawSession) {
        setLabel("");
        return;
      }
      const session = parseStoredFieldSession(rawSession);
      setLabel(formatWeighingSessionDate(session.startedAt));
    }

    function attachToHeader() {
      if (portalHost) return;
      const heading = Array.from(document.querySelectorAll("h1")).find(
        (element) => element.textContent?.includes("PESÉE RAPIDE"),
      );
      if (!(heading instanceof HTMLElement) || !heading.parentElement) return;

      portalHost = heading.parentElement.querySelector<HTMLElement>(
        "[data-weighing-session-date]",
      );
      if (!portalHost) {
        portalHost = document.createElement("div");
        portalHost.dataset.weighingSessionDate = "true";
        heading.insertAdjacentElement("afterend", portalHost);
        createdHost = true;
      }
      setHost(portalHost);
      refreshLabel();
      observer.disconnect();
    }

    const observer = new MutationObserver(attachToHeader);
    observer.observe(document.body, { childList: true, subtree: true });
    attachToHeader();

    const refreshInterval = window.setInterval(refreshLabel, 2000);
    const handleStorage = () => refreshLabel();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshLabel();
    };
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      observer.disconnect();
      window.clearInterval(refreshInterval);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (createdHost) portalHost?.remove();
    };
  }, []);

  if (!host || !label) return null;

  return createPortal(
    <p className="mt-1 text-sm font-black leading-tight">{label}</p>,
    host,
  );
}
