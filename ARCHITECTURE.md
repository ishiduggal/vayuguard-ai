# Architecture
React and TypeScript render five main views plus onboarding. Express serves JSON endpoints and the compiled Vite application. Household state is browser-local; there is no account system or database.

`server/envProvider.ts` retrieves Open-Meteo modeled air-quality/weather and historical weather summaries. Weather is joined by timestamp. Missing or failed feeds produce labeled fallback data. A location/timezone cache reduces duplicate calls.

`src/engine/routineEngine.ts` evaluates hourly candidates against waking hours, durations, fixed commitments, earlier flexible allocations, sensitivities and weather. It uses a greedy scoring heuristic, not a globally optimal scheduler. Exposure is an illustrative PM2.5 × duration × activity/environment-factor index. Unknown inputs remain unknown.

`conflictSolver.ts` proposes bounded time-adjacent trip-sharing candidates. It cannot verify routes, seats or destinations, does not change fixed appointments, and claims zero verified avoided distance. `planRepair.ts` compares recalculated passports against the preceding environment. Simulation changes are labeled.

Indoor, seasonal, AQI and emissions helpers are deterministic. Gemini explains recalculated server plans with minimized context; it does not control the scheduler. The server validates schemas, limits request size and bounds assistant concurrency/rate per process. These limits are not distributed abuse protection.

Deployment uses Node 24, a multistage Dockerfile, non-root runtime, PORT and 0.0.0.0 binding. Container execution and remote deployment remain untested.
