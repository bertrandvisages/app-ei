@AGENTS.md

# Place dans l'architecture

DASH-EI est le dashboard d'admin de l'écosystème `lenoncote.fr`. Trois composants :

| Composant | Rôle | URL | Repo |
|---|---|---|---|
| `lenoncote` | Site public Astro statique | `preview.lenoncote.fr` | `bertrandvisages/noncote` |
| **`DASH-EI`** (ce repo) | Dashboard Next.js | `dash.lenoncote.fr` | `bertrandvisages/app-ei` |
| Supabase self-host | Auth + DB + Storage | `supabase.lenoncote.fr` | — |

Les trois tournent sur le même VPS Hostinger (`178.16.130.176`) orchestré par Coolify.

# Stack

- **Next.js 16** App Router (note les changements de convention v16 : `app/icon.svg` pas `app/favicon.svg`, etc.)
- React 19, TypeScript strict
- Tailwind v4 (sans `tailwind.config`, directives dans `globals.css`)
- shadcn/ui (composants dans `src/components/ui/`)
- Tiptap 3 (`rich-editor.tsx` simple, `rich-editor-full.tsx` complet avec table + headings)
- Supabase SSR (`@supabase/ssr` + middleware) — clé anon côté front, service_role côté server

# Workflow éditorial

L'éditeur navigue dans le dashboard et :
1. Crée / édite un dossier ou une opinion (table `dossiers` / `contributions` côté Supabase)
2. Clic **Publier** ou **Republier** → `PUT /api/wordpress/<entity>` met le status à `publie` et bump `published_at`
3. Le route handler appelle **`triggerLenoncoteRebuild()`** (helper `src/lib/trigger-deploy.ts`) qui POST le webhook Coolify avec `Bearer COOLIFY_API_TOKEN`
4. Le site `preview.lenoncote.fr` rebuilde (~1 min) et lit les nouvelles données depuis Supabase

Le status badge dans les tables affiche **Modifié** quand `updated_at > published_at + 2s` (calculé serveur dans `is_modified`). Republier remet à zéro.

# Pages dashboard

| Route | Données | Notes |
|---|---|---|
| `/dashboard` | redirect → `/dashboard/dossiers` | |
| `/dashboard/dossiers` | `dossiers` table | CRUD, publish, génération image Gemini |
| `/dashboard/contributions` | `contributions` table | dito + champ `citation` (avec génération IA) |
| `/dashboard/auteurs` | `authors` table | CRUD, upload photo Supabase Storage |
| `/dashboard/abonnes` | `subscribers` ∪ `inscrits` | filtres, tri, suppression admin |
| `/dashboard/utilisateurs` | `profiles` | admin only, créer/supprimer éditeurs |

⚠️ Les paths d'API gardent encore le préfixe `/api/wordpress/*` pour minimiser les changements lors de la migration WP → Supabase. Le contenu de ces routes n'a plus rien de WordPress, c'est juste l'historique du nommage.

# Tables Supabase consommées

Voir CLAUDE.md de `lenoncote` pour la vue globale. Côté DASH-EI :
- `profiles` (rôle `admin` ou `editeur`) → gate les pages et boutons
- `authors`, `dossiers`, `contributions`, `articles` → CRUD éditorial
- `inscrits` + `subscribers` → vue Abonnés
- `storage.objects` (bucket `media`) → upload via `/api/wordpress/upload` puis URL stockée dans `image_url` / `cover_image_url`

# Intégrations externes

## Supabase Storage (MinIO)

Bucket `media`, public read. RLS autorise les authentifiés à INSERT/UPDATE/DELETE. Les uploads vont dans des sous-dossiers conventionnels :
- `authors/<original-path>` pour les photos d'auteurs
- `dossiers/generated/<timestamp>.png` pour les covers IA
- `contributions/generated/<timestamp>.png` idem
- `uploads/<folder>/<timestamp>-<name>` pour les uploads ad hoc

## Gemini 3 Pro Image

- `/api/generate-image` : prompt construit serveur à partir de `style` + `title` + `content`, préfixe photoréaliste hardcodé (voir AGENTS.md du repo `lenoncote`)
- `/api/generate-citation` : Gemini 2.5 Flash, `thinkingConfig.thinkingBudget=0` pour éviter les troncatures
- Requiert `GEMINI_API_KEY` runtime côté serveur

## Coolify webhook

- `COOLIFY_DEPLOY_WEBHOOK_URL` + `COOLIFY_API_TOKEN` runtime
- Helper `src/lib/trigger-deploy.ts` (fire-and-forget, logué via console)
- Appelé depuis `/api/wordpress/publish`, `/api/wordpress/dossiers` PUT (sur status `publie`), `/api/wordpress/contributions` PUT (sur status `publie`)

# Build & déploiement

## En local

```bash
nvm use 22
npm install
npm run dev   # http://localhost:3001
```

`.env.local` requis :
```
NEXT_PUBLIC_SUPABASE_URL=https://supabase.lenoncote.fr
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
COOLIFY_DEPLOY_WEBHOOK_URL=...
COOLIFY_API_TOKEN=...
```

## En prod (Coolify)

- Build Pack : **Dockerfile** (multi-stage Node 22 → Next.js standalone)
- Build args : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cochés Build Time **ET** Runtime)
- Runtime only : `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `COOLIFY_DEPLOY_WEBHOOK_URL`, `COOLIFY_API_TOKEN`
- Port : `3000`
- Domains : `https://dash.lenoncote.fr`

Si tu ajoutes une env var et un simple Restart ne la voit pas, fais un **Redeploy** (force-recreate). Restart ne re-lit pas le `.env`.

# Routes API maison

| Route | Méthode | Auth | Rôle |
|---|---|---|---|
| `/api/wordpress/authors` | GET/POST/PUT/DELETE | authenticated | CRUD auteurs |
| `/api/wordpress/dossiers` | GET/POST/PUT/DELETE | authenticated | CRUD dossiers, déclenche rebuild |
| `/api/wordpress/contributions` | GET/POST/PUT/DELETE | authenticated | CRUD opinions, déclenche rebuild |
| `/api/wordpress/publish` | POST | authenticated | flip article à `publie` + rebuild |
| `/api/wordpress/delete` | POST | authenticated | no-op (suppression côté page) |
| `/api/wordpress/upload` | POST | authenticated | upload Supabase Storage |
| `/api/generate-image` | POST | authenticated | Gemini 3 Pro Image |
| `/api/generate-citation` | POST | authenticated | Gemini 2.5 Flash |
| `/api/users/create` | POST | **admin** | crée un éditeur (service_role) |
| `/api/users/delete` | POST | **admin** | supprime un éditeur |
| `/api/subscribers/delete` | POST | **admin** | supprime un abonné (wp ou inscription) |
| `/api/cron/publish-scheduled` | GET | `Bearer CRON_SECRET` | publie les dossiers/contributions `programme` dont `scheduled_publish_at` est passé, puis 1 rebuild. Appelé par une Scheduled Task Coolify (`0 8 * * *`). |

Toutes les routes wrappent leur logique dans try/catch et renvoient **toujours** du JSON (jamais un body vide même en 500), pour éviter le `JSON.parse unexpected end of data` côté client.

# Pièges déjà rencontrés

- **Env var manquante en runtime** : Next.js dans Coolify peut compiler avec une var Build Time mais ne pas l'avoir en runtime. Si une route serveur dit `SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant`, c'est qu'il faut ajouter en Runtime + Redeploy.
- **Disabled button au premier paint** : sur une page client lourde, l'import de `@supabase/supabase-js` peut prendre 1-3 s. Si un bouton dépend du module chargé, montrer un "Chargement…" visible (cf. `/inscription` du repo `lenoncote`).
- **Tiptap n'affiche pas les bullets** : Tailwind preflight reset `list-style: none` sur `ul/ol`. Forcer `list-style: disc outside` / `decimal outside` dans le style de l'éditeur (déjà fait dans `rich-editor-full.tsx`).
- **Partial PUT vs full PUT** : pour les entités (auteurs, dossiers, contributions), n'updater côté DB **que les champs présents** dans le body (`if (body.x !== undefined)`). Sinon une édition de linkedin remet le `image_url` à null parce que le client n'a pas envoyé `image_url`.
- **is_modified post-migration** : si tous les items publiés affichent "Modifié" d'un coup, c'est que `updated_at` a été setté à `now()` lors de la migration alors que `published_at` est l'ancienne date. SQL fix : `UPDATE table SET updated_at = published_at WHERE status='publie' AND updated_at > published_at + interval '2s'`.
