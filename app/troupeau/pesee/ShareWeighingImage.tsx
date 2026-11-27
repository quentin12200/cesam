"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import {
  selectedAverage,
  selectedWeightSummary,
  weighingShareRows,
  type FieldSessionEntry,
} from "@/lib/field-weighing";

type WeighingImageProps = {
  males: FieldSessionEntry[];
  females: FieldSessionEntry[];
  startedAt: string;
};

const WIDTH = 640;
const ROW_HEIGHT = 98;
const HEADER_HEIGHT = 139;
const GROUP_HEIGHT = 84;
const PADDING = 24;
const GREEN = "#245633";
const INK = "#17251c";
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function createWeighingImage({ males, females, startedAt }: WeighingImageProps) {
  const date = new Date(startedAt);
  const groups = [
    { title: "Mâles", sexe: "M", entries: males },
    { title: "Femelles", sexe: "F", entries: females },
  ] as const;
  const height = HEADER_HEIGHT + 2 * GROUP_HEIGHT +
    ROW_HEIGHT * (Math.max(1, males.length) + Math.max(1, females.length));
  const scale = Math.min(1, 16_000 / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(WIDTH * scale);
  canvas.height = Math.ceil(height * scale);
  const drawingContext = canvas.getContext("2d");
  if (!drawingContext) throw new Error("Image indisponible");
  const context = drawingContext;
  context.scale(scale, scale);
  context.textBaseline = "top";

  function box(x: number, y: number, width: number, height: number, color: string) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function label(value: string, x: number, y: number, font: string, color = INK) {
    context.fillStyle = color;
    context.font = `${font} system-ui, sans-serif`;
    context.fillText(value, x, y, WIDTH - x - PADDING);
  }

  box(0, 0, WIDTH, height, "#ffffff");
  box(0, 0, WIDTH, HEADER_HEIGHT - 34, GREEN);
  label("CESAM · Récapitulatif des pesées", PADDING, 17, "bold 31px", "#ffffff");
  label(`${DATE_FORMAT.format(date)} · ${males.length + females.length} pesées`, PADDING, 61, "22px", "#ffffff");
  label("✓ Coché    □ Non coché", PADDING, 113, "18px");

  let y = HEADER_HEIGHT;
  for (const { title, sexe, entries } of groups) {
    const selectedCount = entries.filter((entry) => entry.selected).length;
    box(0, y, WIDTH, GROUP_HEIGHT, "#edf5ed");
    label(title, PADDING, y + 11, "bold 27px", GREEN);
    label(selectedWeightSummary(selectedCount, selectedAverage(entries), sexe), PADDING, y + 47, "bold 21px");
    y += GROUP_HEIGHT;
    if (entries.length === 0) {
      label("Aucun animal pesé", PADDING, y + 25, "22px");
      y += ROW_HEIGHT;
    }

    for (const row of weighingShareRows(entries, date)) {
      box(PADDING, y + 20, 31, 31, row.selected ? GREEN : "#a8b2aa");
      if (row.selected) {
        label("✓", PADDING + 5, y + 20, "bold 24px", "#ffffff");
      } else {
        box(PADDING + 2, y + 22, 27, 27, "#ffffff");
      }
      label(row.weight, 69, y + 8, "bold 28px");
      label(row.details, 69, y + 43, "21px");
      label(row.progress, 69, y + 69, "19px");
      if (row.alert) label(row.alert, 330, y + 69, "bold 19px", "#9a421c");
      box(PADDING, y + ROW_HEIGHT - 1, WIDTH - 2 * PADDING, 1, "#d4ded4");
      y += ROW_HEIGHT;
    }
  }

  // Encode synchronously so Safari can open the share sheet from this tap.
  const data = canvas.toDataURL("image/png").slice("data:image/png;base64,".length);
  if (!data) throw new Error("Image vide");
  const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
  return new File([bytes], `cesam-pesees-${startedAt.slice(0, 10)}.png`, { type: "image/png" });
}

export default function ShareWeighingImage(props: WeighingImageProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function shareImage() {
    setBusy(true);
    setMessage("");
    try {
      const file = createWeighingImage(props);
      const share = { files: [file] };
      if (navigator.share && navigator.canShare?.(share)) {
        try {
          await navigator.share(share);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage("Image téléchargée. Tu peux l’ajouter à ton message WhatsApp.");
    } catch {
      setMessage("Impossible de préparer l’image. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void shareImage()}
        className="flex min-h-16 w-full items-center justify-center gap-3 border-4 border-black bg-white px-4 text-xl font-black disabled:bg-neutral-300"
      >
        <Share2 aria-hidden="true" size={24} />
        PARTAGER SUR WHATSAPP
      </button>
      <p className="mt-1 text-center text-sm">Choisis WhatsApp dans le menu de partage, ou enregistre l’image si le partage direct est indisponible.</p>
      {message && <p role="status" className="mt-2 text-center font-bold">{message}</p>}
    </div>
  );
}
