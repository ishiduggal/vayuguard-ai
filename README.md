# VayuGuard AI — Every Breath, Every Family
A family air-quality planning prototype for PromptWars Challenge 06. It turns modeled pollution and weather into individually constrained daily routines, explains tradeoffs, and recalculates plans when conditions change.

## Run locally
Requires Node.js 24 and npm. Run `npm ci`, copy `.env.example` to `.env`, then `npm run dev`. Production: `npm run build` then `npm start` (default port 8080). The scripts load `.env`; never commit credentials. Without a Gemini key, the assistant explicitly uses deterministic fallback explanations.

## Reviewer walkthrough
1. Load the five-member demo household; inspect data provenance and timestamp.
2. Open Family and compare recommendations, sensitivity and estimated exposure.
3. Open Routine: inspect fixed commitments and adjusted flexible activities.
4. Simulate a pollution spike; inspect Plan Repair differences, then clear it.
5. Inspect household trip-sharing candidates and their unconfirmed feasibility.
6. Open Home; inspect ventilation conditions and scenario assumptions.
7. Ask the assistant a question; inspect whether the response is Gemini or fallback.
8. Edit Setup to change a member's conditions, duration, transport or household resources.

The guided tour follows these views. Onboarding data persist in this browser's local storage. This is a daily schedule, not a rolling next-24-hours dispatcher.

## Verification and delivery
Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm audit`. See [TEST_REPORT.md](TEST_REPORT.md), [AUDIT_REPORT.md](AUDIT_REPORT.md), and [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

A Dockerfile and draft CI workflow are included. Docker execution, live Gemini and Google Cloud Run deployment are **not verified**. No public deployment or submission was made during this audit. This is planning support, not medical diagnosis, a certified exposure model or a validated safety guarantee.
