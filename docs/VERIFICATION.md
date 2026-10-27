# Verification record

Local verification uses Node.js 24.13.1 on Windows, a real PostgreSQL 18 development runtime bound to loopback, Prisma 6.12.0, Vite 7, Vitest 5, and Chromium via Playwright. Both reference documents were analyzed before implementation.

This file records observed checks, not the desktop report's historical results. No cloud deployment is claimed.

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
- Cloud migrations, HTTPS cookie forwarding, Neon connectivity, and actual Vercel/Render origins require authorized accounts and live verification.
- Recipe nutrition, mood suitability, and allergen classifications are editorial demonstration data and need review before broad public use. Images are illustrative.
- Free-tier sleeping services are suitable for a university demonstration but do not provide a production availability guarantee.
