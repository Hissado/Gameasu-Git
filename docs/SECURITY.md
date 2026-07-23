# Sécurité — Gaméasù

Ce document résume les pratiques de sécurité du projet et les points d'attention
identifiés lors de l'audit.

## 1. Gestion des secrets

- **Aucun secret ne doit être committé.** Les fichiers `.env` sont ignorés par
  git (`.gitignore`).
- Le code applicatif ne contient **aucun secret en dur** : toutes les valeurs
  sensibles sont lues via `process.env` (backend) ; le frontend n'expose que des
  variables `VITE_*` publiques.
- En production, les secrets sont fournis via **Replit Secrets**.
- `.env.example` ne contient que des **noms** de variables et des exemples non
  sensibles.

### ⚠️ Action requise — clé exposée dans `.replit`

Le fichier versionné `.replit` contient une valeur en clair de
`CLOUD_STORAGE_ENCRYPTION_KEY` (clé AES-256 servant à chiffrer les tokens OAuth
de stockage cloud). **Cette clé est compromise** dès lors qu'elle est présente
dans l'historique git.

Remédiation recommandée (à réaliser par un mainteneur ayant accès à
l'infrastructure) :

1. **Générer une nouvelle clé** : `openssl rand -base64 32`.
2. La déposer dans **Replit Secrets** (`CLOUD_STORAGE_ENCRYPTION_KEY`).
3. **Retirer la valeur en clair de `.replit`** (le runtime lira la valeur depuis
   les Secrets).
4. Prévoir que la rotation invalide les tokens OAuth déjà chiffrés : les
   utilisateurs devront **reconnecter** leur stockage cloud (Google Drive).
5. Idéalement, purger la valeur de l'historique git (BFG / `git filter-repo`).

> Cette opération n'a volontairement **pas** été automatisée par l'audit :
> supprimer la clé sans l'avoir d'abord placée dans les Secrets casserait le
> déchiffrement des tokens en production. Elle nécessite une intervention
> humaine coordonnée avec l'infrastructure.

## 2. En-têtes HTTP & transport

- `helmet` applique les en-têtes de sécurité (anti-clickjacking, anti-MIME-sniff,
  referrer). **HSTS activé uniquement en production** (`NODE_ENV=production`).
- `trust proxy` activé pour lire la vraie IP client derrière le proxy Replit.

## 3. Authentification & autorisation

- Authentification par **Bearer token** (`requireAuth`).
- Autorisation **RBAC** (rôles + permissions) via `src/lib/rbac` et le middleware
  `permissions.ts`.
- Mots de passe hachés avec **bcryptjs**.
- **Point d'attention :** les fichiers `/uploads` sont protégés par
  authentification mais **sans contrôle d'accès par ressource** (tout utilisateur
  authentifié peut accéder à tout média). Un contrôle d'autorisation par
  ressource (ownership / organisation) est recommandé — voir `CODEBASE_AUDIT.md`.

## 4. Validation des entrées

- Les entrées d'API sont validées par des **schémas Zod** partagés
  (`lib/api-zod`).
- Toute nouvelle route doit valider son corps/paramètres avant traitement.

## 5. Webhooks & paiement

- Les webhooks Stripe et CinetPay reçoivent le **corps brut** et vérifient la
  **signature HMAC** avant traitement (routes montées avant `express.json()`).
- Les tokens OAuth de stockage cloud sont **chiffrés** au repos
  (`cloud-storage/encryption.ts`).

## 6. Journalisation

- Logs structurés via **pino** ; l'URL journalisée est tronquée avant la
  query-string pour éviter de logger des paramètres sensibles.
- Le middleware d'erreur global **masque les erreurs 5xx** au client (message
  générique) et ne journalise les détails que côté serveur.
- **Bonne pratique :** ne jamais logger de mot de passe, token ou donnée
  personnelle sensible.

## 7. Données de démonstration

- Le seed de démonstration crée des comptes à **mot de passe par défaut**
  (`admin123`, etc.). Il doit rester **désactivé en production réelle**
  (`SEED_HISSADO_DEMO` / `SEED_DEMO_DATA`).

## 8. Signalement d'une vulnérabilité

Contacter l'équipe à **security@gameasu.com** (ou `support@gameasu.com`) sans
divulgation publique préalable.
