"use client";

interface Props {
  nutrav: string;
  className?: string;
}

function fontSize(len: number): string {
  if (len <= 3) return "text-xl";
  if (len <= 4) return "text-lg";
  if (len <= 5) return "text-base";
  if (len <= 6) return "text-sm";
  return "text-xs";
}

export default function NutravBadge({ nutrav, className = "" }: Props) {
  return (
    <span
      className={`bg-green-700 text-white font-bold px-3 py-2 rounded-lg font-mono min-w-[4.5rem] text-center flex-shrink-0 flex items-center justify-center leading-none ${fontSize(nutrav.length)} ${className}`}
    >
      {nutrav}
    </span>
  );
}
