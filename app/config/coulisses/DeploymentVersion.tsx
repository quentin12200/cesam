export default function DeploymentVersion() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const environment = process.env.VERCEL_ENV;
  return <section className="rounded-xl border bg-white p-3" aria-label="Version déployée">
    <h2 className="font-bold">Version déployée</h2>
    <p className="text-sm text-slate-700">Commit : <code>{sha?.slice(0,8) || "Non renseigné"}</code></p>
    <p className="text-sm text-slate-700">Environnement : {environment || "Non renseigné"}</p>
    <p className="text-xs text-slate-600">Compare ce numéro avec le dernier déploiement GitHub. Si différent, ferme CESAM puis ouvre-le dans Safari.</p>
  </section>;
}
