import type { ButtonHTMLAttributes } from "react";
import { ACTION_VISUALS, type ActionVisualKey } from "@/components/action-visuals";

interface QuickActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  action: ActionVisualKey;
}

export default function QuickActionButton({
  action,
  className = "",
  type = "button",
  ...props
}: QuickActionButtonProps) {
  const visual = ACTION_VISUALS[action];
  const Icon = visual.icon;

  return (
    <button
      {...props}
      type={type}
      className={[
        "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2",
        "touch-manipulation text-sm font-semibold shadow-sm transition duration-150 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        visual.className,
        visual.focusClassName,
        className,
      ].join(" ")}
    >
      <Icon size={20} className="shrink-0" />
      <span>{visual.label}</span>
    </button>
  );
}
