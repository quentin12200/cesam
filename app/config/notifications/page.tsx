import BackButton from "@/app/components/BackButton";
import NotificationBell from "@/app/components/NotificationBell";

export default function NotificationSettingsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-3 py-4 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <BackButton className="rounded-lg bg-white p-2 text-slate-500 shadow-sm" iconSize={18} />
        <div>
          <p className="text-xs font-bold text-green-700">Paramètres</p>
          <h1 className="text-xl font-black text-slate-900">Notifications</h1>
        </div>
      </header>
      <NotificationBell />
    </main>
  );
}
