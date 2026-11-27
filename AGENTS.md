# AGENTS.md — Repository Engineering & Safety Rules

This repository implements **VayuGuard AI — Every Breath, Every Family** for Google for Developers × Hack2skill PromptWars: Virtual (Main Challenge 06: Urban Air Quality Assistant).

## Non-Negotiable Engineering & Safety Invariants

1. **Deterministic Core First**: All routine scheduling (`src/engine/routineEngine.ts`), household coordination (`src/engine/conflictSolver.ts`), plan repair (`src/engine/planRepair.ts`), indoor guidance (`src/engine/indoorAir.ts`), green impact (`src/engine/greenImpact.ts`), and seasonal outlooks (`src/engine/seasonalOutlook.ts`) must remain pure, deterministic TypeScript with zero LLM dependency.
2. **Gemini Is Explanation-Only**: `server/geminiService.ts` explains verified telemetry and deterministic engine outputs in English, Hindi, Punjabi, and Roman Punjabi. It must never invent measurements or override safety rules.
3. **Medical Safety Guardrails**:
   - Never diagnose diseases, prescribe medication, or modify clinician treatment.
   - Never suggest fever is caused by air pollution.
   - Severe breathing difficulty (`urgentSymptomsReported` or symptom text match) must trigger immediate urgent-care guidance and pause routine outdoor optimization.
4. **Scientific Honesty**:
   - Never confuse US EPA AQI (`Open-Meteo us_aqi`), European AQI, and Indian CPCB NAQI.
   - `computeIllustrativeCpcbPm25SubIndex` must always remain labeled as an illustrative hourly modeled PM2.5 sub-index, never official 24-hour station NAQI.
   - Never claim indoor PM2.5 measurements without an actual user-entered sensor reading.
   - Never recommend walking/cycling solely for emissions savings when PM2.5 > 90 µg/m³.
   - Never recommend sealing rooms airtight during active gas or biomass cooking.
5. **Privacy**: Never commit `.env` or API keys. Strip member names and free-text medical notes in `buildAnonymizedGroundingContext` before sending context to Gemini.

## Standard Commands

- `npm run dev` — Run Vite dev frontend + TSX API server concurrently
- `npm run typecheck` — Strict TypeScript check for client and server
- `npm run lint` — ESLint check across `src` and `server`
- `npm test` — Vitest unit, backend integration, and UI flow tests
- `npm run build` — Production Vite client + Node server compilation
- `npm start` — Launch compiled production server on `PORT` (default `8080`)
