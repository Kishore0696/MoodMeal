# Reference analysis

Both supplied documents were read before application implementation. DOCX text was extracted from `word/document.xml`; the PDF presentation was extracted with pdf-parse. The report is the primary functional reference.

## Preserved design

The report (sections 3.2 and 4.2–4.3) specifies manual mood selection, pantry and nutrition inputs, rule-based filtering/ranking, visual recipe cards, persistent mood-to-meal history, and descriptive charts. It names eight relational tables and gives `S = wm·M + wi·I + wn·N + wc·C`. It does not assign numeric weights. The presentation corroborates the User, Recipe, Recommendation, History & Analytics, and Database modules.

The five moods are Happy, Stressed, Low Energy, Celebratory, and Neutral. Stressed favors comfort and short preparation; Low Energy favors energy suitability and simplicity; Celebratory favors special meals; Happy balances comfort and energy; Neutral emphasizes nutrition fit. None is automatically detected.

## Web transformation

| Original | Web application |
|---|---|
| Swing / JavaFX | React, Vite, TypeScript, React Router |
| Java application services | Express TypeScript REST API |
| JDBC / MySQL | Prisma / PostgreSQL |
| JFreeChart | Recharts, based on saved records |
| Single local user assumption | Independent users with server-scoped queries |

Security additions include bcrypt password hashes, hashed opaque session tokens, session rotation, HttpOnly cookies, origin and synchronizer-token CSRF checks, restricted CORS, input validation, and administrator authorization for shared catalog changes.

Explicit dietary restrictions are hard exclusions. Calorie preference is a soft fit rather than a rigid restrictive target; maximum total time is a hard user-set filter. These clarify the report's generic nutrition filter for a public wellness application.

## Recommendation specification

Defaults: mood 0.35, ingredients 0.30, nutrition 0.20, comfort/energy 0.15. All components are normalized to [0,1]. Configuration rejects invalid or non-unit weight sums.

- M: saved mood tag / 100.
- I: number of required ingredient names in pantry / number of required ingredients. Exact normalized names; water is implicit. Quantities do not imply sufficiency.
- N: average of calorie proximity and protein fit. Calorie proximity = clamp(1 − abs(recipe calories − preference) / preference); absent preference = 1. Higher-protein fit = clamp(protein grams / 30); balanced = 1. These are ranking heuristics, not clinical goals.
- C: stressed = .75 comfort + .25 quickness; low energy = .65 energy + .25 quickness + .10 lightness; celebratory = .80 comfort + .20 energy; neutral = N; happy = 1 − abs(comfort − energy). Quickness = clamp(1 − total minutes / 90), lightness = clamp(1 − calories / 1000).
- Final score: rounded weighted sum × 100. Ties sort by recipe name then ID.

Dietary compatibility is checked first using positive dietary tags and absence of conflicting allergens. Maximum time is applied before scoring. No result is synthesized if nothing fits. Choosing a meal recomputes eligibility on the server and saves its scoring/nutrition/preferences snapshot.

## Data limitations

The 42 recipes are editorial demonstration data with household quantities and per-serving approximate nutrition. Mood tags are deterministic editorial heuristics. Photography is illustrative Unsplash food photography with a bundled fallback; photographs may not depict each named dish. Catalog metadata needs editorial review before broad release. The report's original test results are historical claims about its desktop prototype, not evidence for this web implementation. Web test evidence is recorded separately in VERIFICATION.md.
