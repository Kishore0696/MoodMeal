# Deploying MoodMeal

Target: Vercel frontend → Render Express backend → Neon PostgreSQL. All URLs below are configuration instructions; no live deployment is asserted. Node.js 24 is the tested runtime. Complete account authorization in the providers' dashboards; never paste database passwords or access tokens into chat or commit them.

## 1. Push to GitHub

### Current deployment progress

- Source is published at https://github.com/Kishore0696/MoodMeal. Application commit `e9aaa60` passed all GitHub Actions checks, including PostgreSQL migration/seeding, backend tests, both builds, and browser workflows.
- Vercel project `moodmeal` has been created (project ID `prj_eiIxL2Im3mjJORBfbCgonU5QcbAA`). The verified domain `moodmeal-kishore0696.vercel.app` is assigned to it, but no deployment is live yet.
- The Render blueprint uses this exact frontend origin. Neon provisioning, Render provisioning, production migrations/seeding, the Vercel API rewrite, and live verification remain pending provider access.
- Do not deploy the frontend until `REPLACE_WITH_RENDER_HOST` in `frontend/vercel.json` is replaced with the actual healthy backend hostname.

The following instructions also support setting up a fresh copy in a different account; use that account's actual domain when configuring `FRONTEND_ORIGIN`.

Create an empty private or public repository in your own GitHub account. Inspect `.gitignore` and verify `.env`, `.local`, `node_modules`, screenshots containing private records, and test traces are excluded. Both supplied reference documents contain student details; decide whether they belong in a public portfolio repository before adding them.

```sh
git init
git add frontend backend scripts e2e docs .github README.md DEPLOYMENT.md .gitignore package.json package-lock.json playwright.config.ts render.yaml .env.example
git diff --cached --stat
git commit -m "Build MoodMeal web application"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Use GitHub's normal sign-in or credential manager if prompted. Do not add personal tokens to remote URLs. The application has no dependency on the original reference documents at runtime.

## 2. Create Neon PostgreSQL

Create a Neon project in a region near the Render backend. Choose a supported PostgreSQL version, a database, and a restricted application role. Copy the pooled application connection string into Render's `DATABASE_URL`. Copy the direct connection string into `DIRECT_URL`, preserving Neon's SSL parameters such as `sslmode=require`. Migrations need the direct URL; application traffic can use pooling. See [Prisma 6 Neon guidance](https://docs.prisma.io/docs/orm/v6/overview/databases/neon).

Use a separate Neon branch/database for tests. Enable backup/restore facilities suitable for your plan. Confirm current quotas before using any free tier.

## 3. Deploy backend to Render

Connect your GitHub repository to a new **Web Service** (Node runtime). Keep its root directory at repository root, because this is an npm workspace.

| Setting | Value |
|---|---|
| Build | `npm ci --include=dev && npm run build -w backend` |
| Start | `npm run db:migrate && npm run start -w backend` |
| Health check | `/api/health` |
| Node version | `24` |

The committed `render.yaml` captures these settings. Starting with migration deploy allows the demonstration configuration to work without a paid pre-deploy command. For multi-instance production releases, move migration deployment to a single release job, then start only the application. Never run destructive reset commands on production.

Render's [Express deployment instructions](https://render.com/docs/deploy-node-express-app) explain Git connection and deployment. Free web services are appropriate for demonstration and can sleep; Render [does not recommend them for production](https://render.com/docs/free). Choose a suitable instance for real users.

## 4. Configure backend environment

Set these through Render's secret/environment UI:

```dotenv
NODE_ENV=production
DATABASE_URL=<Neon pooled connection string>
DIRECT_URL=<Neon direct connection string>
FRONTEND_ORIGIN=<exact HTTPS Vercel origin, without trailing slash>
COOKIE_SAME_SITE=lax
SESSION_DAYS=7
RECOMMENDATION_WEIGHTS=0.35,0.30,0.20,0.15
```

Render provides `PORT`. `FRONTEND_ORIGIN` can initially be your intended frontend origin, then be replaced by the actual Vercel origin before testing auth. Secure cookies are enforced automatically in production. Sessions are stored in PostgreSQL and survive process restarts. Passwords use bcrypt cost 12; session tokens use 32 random bytes with SHA-256 hashes at rest. No secret belongs in frontend variables.

## 5. Run production migrations and seed

The start command applies committed migrations before listening. Verify logs say all migrations are applied. Run the idempotent seed once from a trusted machine with backend production environment loaded, or Render's shell if your plan offers it:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed updates shared catalog entries by slug; it preserves user data. Review changed recipes before reseeding production because editorial changes update matching catalog records. Do not automatically reseed on every server restart. Check `/api/health` and `/api/recipes?limit=1` on the actual Render URL. Expect `status: ok` and a catalog total of 42 after initial seed.

## 6. Deploy frontend to Vercel

Import the same GitHub repository. Choose root directory **frontend** and framework **Vite**. Enable access to files outside the root directory if Vercel asks, so the workspace lockfile is available. Use install command `npm ci`, build command `npm run build`, output `dist`, Node.js 24. Set `VITE_API_URL=/api`.

Before deploying, replace `REPLACE_WITH_RENDER_HOST` in `frontend/vercel.json` with the literal actual Render hostname (without `https://`, because it is already present). Keep `/api/:path*` before the SPA fallback. Vercel's [external rewrites](https://vercel.com/docs/routing/rewrites) support this reverse-proxy topology. The API remains on Render; Vercel serves the frontend and forwards API calls.

Do not deploy the unresolved placeholder. Do not put a database URL in Vercel's frontend environment. After successful deployment, copy the actual Vercel origin to Render's `FRONTEND_ORIGIN` and restart/redeploy the backend. Rebuild the frontend if a VITE variable changes, because it is compiled into the bundle.

## 7. Connect cookies, CORS and routing

**Recommended:** browser calls `/api` on Vercel, Vercel rewrites to Render, and host-only cookies are first-party to the frontend origin. Use `SameSite=lax`, Secure, HttpOnly. The browser's Origin must match the backend's exact configured frontend origin; there is no wildcard allowlist.

**Alternative direct cross-site API:** set `VITE_API_URL` to the actual Render HTTPS URL plus `/api`, remove the API proxy rewrite if unused, and set backend `COOKIE_SAME_SITE=none`. Secure cookies and credentials mode are already implemented. Some browsers block third-party cookies, so prefer the proxy or same-site custom domains. Never weaken cookies to make HTTP production work.

CSRF: `/auth/me`, registration and login return a session synchronizer token kept in memory; authenticated mutations send `X-CSRF-Token`. All mutations, including unauthenticated login/register, also require the exact frontend Origin. If a session rotates in another tab, refresh the page to obtain the current token. CORS and CSRF checks both apply.

Preview deployments use different origins. Test against a separate backend/database configured for that preview origin; do not broadly allow arbitrary Vercel origins or share production cookies with unreviewed previews.

## 8. Live acceptance test

1. Open the actual frontend URL and refresh `/recipes` directly to confirm SPA routing.
2. Confirm landing featured recipes and recipe detail data load from the backend.
3. Register a fresh account, reload, and verify the session persists. In browser devtools, inspect cookie flags without copying token values.
4. Select Stressed, add rice and vegetables to the pantry, and save dietary preferences.
5. Find a meal; confirm availability, missing ingredients, component explanation, and a reasonable ranking.
6. Apply a vegan restriction and confirm non-vegan recipes disappear; try an impossible combination for the empty state.
7. Choose a meal, visit history, filter by mood/date, and reload to verify persistence.
8. Open analytics and confirm the chart counts match the saved records.
9. Sign into a second account and verify its pantry/history are empty. Attempting to edit shared recipes as a normal user must fail.
10. Promote only a trusted registered account using the backend admin utility. Check create/update/archive and preserved history.
11. Test mobile layout, keyboard focus, failed login, unavailable backend, and logout.
12. Record actual URLs, deployment IDs, test date, and outcomes in `docs/VERIFICATION.md`. Do not mark live verification passed until performed.

## Troubleshooting

| Symptom | Check / correction |
|---|---|
| 503 / startup crash | Database URLs, SSL parameters, reachable Neon project, migration permissions |
| P1001 | Neon connectivity, correct hostname/port, database awake, Render outbound access |
| No recipes | Run seed against the same database used by Render |
| Browser requests return HTML | API rewrite must precede SPA fallback; verify actual Render host |
| 403 Origin | Exact frontend scheme/host/port; no trailing slash; local browser should use localhost |
| 403 CSRF | Refresh to get session token; ensure credentials and X-CSRF-Token reach backend |
| Session disappears | Inspect Set-Cookie flags; use proxy, HTTPS, credentials; avoid third-party cookie blocking |
| Direct links 404 | Restore SPA rewrite to `/index.html` |
| Free backend slow initially | Render cold start; check health and current plan limits |
| Windows seed encoding error | Use UTF-8 PostgreSQL database; local helper initializes UTF-8 explicitly |
| Prisma generation download fails | Permit HTTPS access to Prisma engine binaries and npm registry |
| Rate limited | Wait for window reset; do not disable protection in public deployment |

## Maintenance and release limits

Use one backend instance with the current in-process limiter; introduce a distributed limiter before horizontal scaling. Prune expired sessions periodically (`DELETE FROM sessions WHERE "expiresAt" < NOW()`) using operator-managed scheduling. Back up and rehearse restore before schema changes. Rotate database credentials via provider settings and redeploy. Add account verification/recovery before broad consumer release. Review the editorial recipe/allergen metadata; this application does not certify food safety or diagnose mood or nutrition conditions.
