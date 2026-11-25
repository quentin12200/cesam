# Coulisses CESAM — phase 1

Centre de navigation privé, accessible via Paramètres > Les Coulisses. Les cinq liens réutilisent les écrans existants ; aucune nouvelle API, requête Prisma ou mutation. Aucun compteur d'anomalies inventé. Les outils cibles conservent leurs permissions et comportements actuels. Le hub ne rend pas ces outils lecture seule.

Le Lab actuel reste disponible et utilise encore les données réelles. Ne pas le présenter comme un environnement de test isolé. Le futur Lab fictif est un chantier distinct. Les diagnostics transversaux et l'historique centralisé sont également hors périmètre.

Tests : présence des routes, absence de mutation directe, accès aux paramètres et au Lab, classes de mise en page et protection par le middleware existant. Contrôle visuel à effectuer à 375/390 px et sur ordinateur ; ne pas déclencher de correction réelle en test.
