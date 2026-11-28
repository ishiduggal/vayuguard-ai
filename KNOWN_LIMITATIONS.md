# Known limitations
- Live Gemini behavior, permissions and billing are unverified; current local operation uses fallback.
- Docker and gcloud are absent in the audit environment; no container run or Cloud Run URL was verified.
- Household coordination is a candidate heuristic without routing, capacity, destination matching or confirmed savings.
- Scheduling is greedy and produces a complete day, including earlier hours. Cross-midnight activity durations and globally optimal joint scheduling are not implemented.
- Pollution is modeled; fallback is synthetic. No station validation or medical validation was performed.
- Exposure and CO2 factors are illustrative assumptions. No measured health or emissions improvement is claimed.
- Localization covers assistant templates/model requests, not the entire UI; some explanations remain English.
- Browser checks cover desktop and a narrow embedded viewport, not physical devices, all assistive technologies or every browser.
- Local storage has no account sync/encryption. Rate limits are per server instance.
- Private submission-portal requirements, deadline and provenance evidence still need participant verification.

## Organizer email clarification — 27 November 2026
Organizer emails confirm: Challenge 06 closes 29 November 2026 at 11:59 p.m. IST. Submission requires code, a live app running on Google Cloud Run, and a LinkedIn build-in-public post. Three attempts are allowed; the LAST submission determines final ranking. Latest Challenge 06 email permits any AI tools/stack, clarifying older Antigravity wording. Final Top 400 receive manual review after automated evaluation. Portal fields still need inspection. This clarification supersedes earlier uncertainty about Cloud Run, deadline and tool choice.

## Verification update — 28 November 2026
The public repository is https://github.com/ishiduggal/vayuguard-ai . GitHub Actions run 46038296726 passed all checks including Linux Docker build and running-container health. This supersedes earlier statements that Docker/CI were unverified. Cloud Run deployment and live Gemini remain pending; Google Cloud login is required.
