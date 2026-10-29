# Verification record

Local verification uses Node.js 24.13.1 on Windows, a real PostgreSQL 18 development runtime bound to loopback, Prisma 6.12.0, Vite 7, Vitest 5, and Chromium via Playwright. Both reference documents were analyzed before implementation.

This file records observed checks, not the desktop report's historical results. The public deployment was verified on 2026-10-29.

## Public deployment verification

- Vercel production deployment `dpl_9vZF3zvAcmRc3WPUodETmkmQzUrZ` reached READY. The live canonical URL is https://moodmeal-kishore0696.vercel.app.
- Render deployment `dep-dbgku6uc6qcc73bv7v1g` reached live. Both its direct health check and the Vercel `/api/health` proxy returned `status: ok`; `/dashboard` returned HTTP 200 through the SPA fallback.
- The real Chromium account workflow passed against the public URL: registration, mood, pantry, preferences, recommendations, selected meal, persistent history, analytics, logout, and login.
- The public desktop/mobile presentation test passed, with loaded photography, working navigation, no page errors, and no horizontal overflow at 390px. Screenshots in `docs/screenshots/` now show the deployed homepage.
- The exact temporary test account and its associated records were removed after verification. The database retained all 42 recipes, 66 ingredients, and 210 mood tags, with zero synthetic user histories.
- Production migrations use a normal Node child process so secret-file environment settings reach Prisma; this was checked locally against Neon and during Render startup.

## Evidence

- Initial PostgreSQL migration successfully applied to UTF-8 development and isolated test databases.
- 42 editorial recipes seeded with relational ingredients and five mood tags each.
- Backend unit and integration suite: **19/19 passed**, against actual PostgreSQL, including administrator create/update/archive.
- Frontend and backend production builds passed. Analytics and administration code are separate lazy-loaded chunks.
- Dependency install/audit reported zero known vulnerabilities after pinning Prisma 6.12.0 and using patched Zod and Vitest.
- Both Playwright browser tests passed (2/2): the complete persistent account-to-meal workflow and desktop/390px mobile presentation, including navigation, no horizontal page overflow, and no JavaScript page errors.
- Actual homepage screenshots are in `docs/screenshots/`. The six food photographs are bundled locally so runtime rendering does not require the external image CDN.

## Workflow and security coverage

Automated backend tests cover registration, secure password/session storage, login, session rotation, CSRF/origin rejection, mood persistence, pantry create/read/update/delete, recipe retrieval, ranking, dietary exclusions, saved history snapshots, date/mood filtering, user data isolation, analytics, logout, and administrator catalog CRUD.

The browser workflow covers registration → mood selection → pantry ingredients → preferences → recommendations → meal selection → history → history reload → analytics → logout → login → persistent history. Earlier runs exposed a strict dropdown selector and a post-logout routing race; both were corrected before final verification.

## Limits

- No load test or multi-instance limiter verification. The supplied limiter is per process.
- No complete formal WCAG audit. Keyboard labels, skip link, focus styles, reduced motion, chart data tables, responsive navigation, and mobile overflow are implemented.
- Cloud migrations, Neon connectivity, the canonical origin, and cookie-based sessions through Vercel were verified by the live workflow. Other browsers and alternate hostnames have not been verified.
- Recipe nutrition, mood suitability, and allergen classifications are editorial demonstration data and need review before broad public use. Images are illustrative.
- Free-tier sleeping services are suitable for a university demonstration but do not provide a production availability guarantee.
