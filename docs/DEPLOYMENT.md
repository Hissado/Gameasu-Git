# Déploiement — Gaméasù

## 1. Hébergement actuel

La plateforme est déployée sur **Replit Autoscale Deployment** (voir `.replit`)
et exposée sur **erp.gameasu.com**.

```toml
# .replit (extrait)
[deployment]
router = "application"
deploymentTarget = "autoscale"

[deployment.postBuild]
args = ["pnpm", "store", "prune"]
env = { "CI" = "true" }
```

- **Runtime :** Node.js 24, PostgreSQL 16 (modules Replit).
- **Build :** `pnpm run build` (typecheck + build de tous les paquets), puis
  `pnpm store prune` pour alléger l'image.
- **Post-merge :** `scripts/post-merge.sh` (hook exécuté après merge).

## 2. Variables d'environnement

Toutes les variables attendues sont listées et commentées dans `.env.example`.

- En développement : fichier `.env` local (non versionné).
- En production : **Replit Secrets** (gestionnaire de secrets de la plateforme).
  Ne jamais placer de secret dans un fichier versionné (`.replit`, `.env`
  committé, etc.).

### Variables critiques en production

| Variable                         | Rôle                                             |
| -------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                   | Connexion PostgreSQL de production               |
| `NODE_ENV=production`            | Active HSTS, désactive les traces de debug       |
| `PUBLIC_BASE_URL`                | Origine de l'ERP (liens des emails)              |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Paiement carte                      |
| `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` / `CINETPAY_SECRET_KEY` | Mobile Money      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google Drive                    |
| `CLOUD_STORAGE_ENCRYPTION_KEY`   | Chiffrement des tokens OAuth stockés (AES-256)   |
| `RESEND_API_KEY` (ou `SENDGRID_API_KEY`) | Emails transactionnels                   |

## 3. Procédure de mise en production

1. Fusionner les changements validés dans `main` (typecheck vert).
2. Vérifier que les **Replit Secrets** de production sont à jour (nouvelles
   variables éventuelles ajoutées à `.env.example`).
3. Vérifier que `SEED_HISSADO_DEMO` et `SEED_DEMO_DATA` sont **désactivés** sur
   la base de production réelle (sinon comptes de démo à mot de passe par défaut).
4. Appliquer les éventuelles migrations de schéma sur la base de production.
5. Lancer le déploiement Replit (build automatique via `deployment.postBuild`).
6. Vérifier après déploiement :
   - `/api/health` répond ;
   - authentification fonctionnelle ;
   - pages principales accessibles ;
   - webhooks paiement joignables (endpoints publics `/api/webhooks/*`).

## 4. Checklist avant chaque déploiement

- [ ] `pnpm run typecheck` passe.
- [ ] Aucun secret ajouté dans un fichier versionné.
- [ ] `.env.example` à jour si de nouvelles variables ont été introduites.
- [ ] Migrations de base de données appliquées et réversibles.
- [ ] Seed de démonstration désactivé en production réelle.
- [ ] Journalisation d'erreurs vérifiée (pas de fuite d'information sensible).

## 5. Rollback

En cas de régression : redéployer la version précédente depuis l'historique
Replit et, si une migration a modifié le schéma, appliquer la migration inverse
avant de restaurer le code.
