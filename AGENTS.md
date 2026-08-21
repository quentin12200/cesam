<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow des chantiers CESAM

Pour chaque chantier demandé :

1. Travailler sur une branche dédiée.
2. Rester strictement dans le périmètre demandé.
3. Lancer uniquement les tests ciblés nécessaires, TypeScript, le lint ciblé et `git diff --check`.
4. Si tous les contrôles réussissent et qu’il n’y a ni migration Prisma, ni changement destructif, ni conflit :
   - committer automatiquement ;
   - fusionner dans `principal` ;
   - pousser `principal` sur GitHub ;
   - ne pas demander de validation intermédiaire.
5. Retourner seulement un résumé court indiquant :
   - ce qui a été fait ;
   - les tests exécutés ;
   - le hash du commit ;
   - la confirmation du push.

S’arrêter et demander confirmation uniquement si :

- une migration Prisma est nécessaire ;
- une donnée existante risque d’être supprimée ou transformée ;
- les tests échouent ;
- un conflit de fusion existe ;
- la solution nécessite de sortir nettement du périmètre demandé.

Ne jamais exécuter `prisma migrate reset`.
Ne jamais modifier une ancienne migration déjà déployée.
Ne pas toucher aux autres chantiers ou worktrees.
