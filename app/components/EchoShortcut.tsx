import Link from "next/link";
import { HeartPulse } from "lucide-react";

export default function EchoShortcut({ echoCount }: { echoCount: number | null }) {
  return (
    <Link prefetch={false} href="/reproduction?filtre=JAUNE" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-300 bg-amber-50 px-1 py-1 text-center text-xs font-semibold leading-tight text-amber-900 shadow-sm">
      <HeartPulse size={16} className="shrink-0" />
      <span>Échographies à faire</span>
      <span aria-label="Nombre de femelles à échographier">{echoCount ?? "—"}</span>
    </Link>
  );
}
