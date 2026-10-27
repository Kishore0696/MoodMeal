# REST API

Base `/api`. JSON requests and responses. Errors use `{ "error": { "message": "…", "details": {} } }`; validation details are optional. Standard statuses: 400 validation, 401 unauthenticated, 403 unauthorized/CSRF, 404 missing record, 409 conflict, 422 incompatible meal, 429 rate limit, 503 unavailable dependency.

All mutation requests require `Origin` equal to `FRONTEND_ORIGIN`. Authenticated mutations additionally require `X-CSRF-Token` returned by login/register/current user and the HttpOnly `mm_session` cookie. Fetch with `credentials: include`. User IDs are never accepted from clients for private records.

| Method | Route | Access | Input / response |
|---|---|---|---|
| GET | /health | Public | Database health `{status: "ok"}` |
| POST | /auth/register | Public, rate limited | `{name,email,password}` → `{user,csrfToken}` and cookie |
| POST | /auth/login | Public, rate limited | `{email,password}` → `{user,csrfToken}` and rotated cookie |
| GET | /auth/me | Signed in | Current safe user and CSRF token |
| POST | /auth/logout | Signed in + CSRF | Deletes session, clears cookie, 204 |
| GET | /profile | Signed in | Safe profile |
| PATCH | /profile | Signed in + CSRF | `{name?,preferences?}` → updated profile |
| GET | /ingredients | Public | `?search=` ingredient autocomplete, up to 30 |
| GET | /recipes | Public | `?search=&diet=any|vegetarian|vegan&page=1&limit=12` → `{recipes,total,page}` |
| GET | /recipes/:id | Public | Active recipe by ID or slug, relational ingredients/mood tags |
| GET | /pantry | Signed in | Own pantry items with ingredient names |
| POST | /pantry | Signed in + CSRF | `{name,quantity?}` normalized upsert |
| PATCH | /pantry/:id | Signed in + CSRF | `{quantity}`; own items only |
| DELETE | /pantry/:id | Signed in + CSRF | Own item only, 204 |
| POST | /moods | Signed in + CSRF | `{mood}` → persisted mood log |
| GET | /moods | Signed in | Own 365 most recent logs |
| POST | /recommendations | Signed in + CSRF | `{moodLogId}` owned by user → `{recipes,weights}` |
| POST | /history | Signed in + CSRF | `{recipeId,moodLogId}` → saved meal and snapshot, 201 |
| GET | /history | Signed in | `?mood=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1` → `{history,total}`; inclusive UTC dates, 30/page |
| GET | /analytics | Signed in | Actual mood frequency, meals by mood, favorites, daily trends |
| GET | /admin/recipes | Admin | Active and archived catalog |
| POST | /admin/recipes | Admin + CSRF | Validated full recipe → 201 |
| PUT | /admin/recipes/:id | Admin + CSRF | Full recipe, replaces relations transactionally |
| DELETE | /admin/recipes/:id | Admin + CSRF | Archives shared recipe, 204 |

Mood values: `HAPPY`, `STRESSED`, `LOW_ENERGY`, `CELEBRATORY`, `NEUTRAL`. Preferences: `{diet:"any"|"vegetarian"|"vegan", proteinPreference:"balanced"|"high", caloriePreference?:200..1500|null, maxTime?:5..240|null, restrictions:["gluten-free"|"dairy-free"|"nut-free"|"egg-free"|"soy-free"]}`. Numeric preference bounds are input guardrails, not recommendations.

Admin payload definitions are in `backend/src/validators/index.ts`. All five mood tags are required exactly once. The admin interface exports an editable existing recipe as a complete template. Password hashes and session token hashes are never in user responses.
