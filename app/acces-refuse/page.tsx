export default function AccesRefusePage() {
  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <span className="text-5xl">🚫</span>
        <h1 className="text-xl font-bold text-gray-800">Accès refusé</h1>
        <p className="text-sm text-gray-500">
          Votre compte n&apos;est pas autorisé à accéder à cette application.
          Le propriétaire a été notifié de votre tentative de connexion.
        </p>
        <a href="/login" className="mt-2 text-sm text-green-700 font-medium hover:underline">
          Retour à la connexion
        </a>
      </div>
    </div>
  );
}
