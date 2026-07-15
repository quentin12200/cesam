import type { ComponentType } from "react";
import { Heart, Stethoscope, Thermometer } from "lucide-react";
import CalvingIcon from "@/components/CalvingIcon";

export type ActionVisualKey =
  | "chaleur"
  | "saillieIA"
  | "evenementSanitaire"
  | "traitement"
  | "velage";

type ActionIcon = ComponentType<{ size?: number; className?: string }>;

export interface ActionVisual {
  label: string;
  icon: ActionIcon;
  className: string;
  focusClassName: string;
}

/** Référentiel unique des intitulés, icônes et couleurs des actions métier. */
export const ACTION_VISUALS: Record<ActionVisualKey, ActionVisual> = {
  chaleur: {
    label: "Chaleur",
    icon: Thermometer,
    className: "border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100",
    focusClassName: "focus-visible:ring-pink-500",
  },
  saillieIA: {
    label: "Saillie / IA",
    icon: Heart,
    className: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100",
    focusClassName: "focus-visible:ring-fuchsia-500",
  },
  evenementSanitaire: {
    label: "Événement",
    icon: Stethoscope,
    className: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    focusClassName: "focus-visible:ring-blue-500",
  },
  traitement: {
    label: "Traitement",
    icon: Stethoscope,
    className: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    focusClassName: "focus-visible:ring-blue-500",
  },
  velage: {
    label: "Vêlage",
    icon: CalvingIcon,
    className: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
    focusClassName: "focus-visible:ring-rose-500",
  },
};
