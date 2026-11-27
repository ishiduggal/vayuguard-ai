# Competition readiness audit
**Verdict: FIX FIRST. Readiness: 78/100 (independent engineering assessment, not official judging criteria).**

| Area | Score | Evidence/limit |
|---|---:|---|
| Personal planning | 18/20 | Distinct sensitivity decisions, duration/commitment regression tests; greedy daily scheduling |
| Environmental interpretation | 14/15 | Actual modeled API response, timestamp joining, honest missing/synthetic data |
| Distinctive coordination and repair | 10/15 | Real recalculation; coordination candidates require human feasibility confirmation |
| Safety and privacy | 12/15 | Urgent pause, ventilation consistency, minimized context; no clinical/live-model review |
| Reviewer UX | 8/10 | Desktop/narrow viewport walkthrough, persistent tour; incomplete localization |
| Engineering reliability | 13/15 | 36 tests, type/lint/build, dependency audit; no executed container/CI |
| Delivery | 3/10 | Reproducible local source and drafts; public preview and live Gemini pending |
| Total | 78/100 | Conditional prototype readiness |

## High-impact repairs
- Replaced overlapping flexible schedules with duration-aware allocation around fixed commitments; reported infeasible slots and fixed overlaps explicitly.
- Made sensitivity, weather, urgent symptoms and toddler precautions affect actual plans. Removed the residual exercise suggestion during an urgent pause.
- Removed invented trip distances and savings; candidates no longer move fixed commitments or include urgent members.
- Made routine, indoor and checklist ventilation advice consistent; removed unsafe visual-air-quality inference.
- Preserved unknown exposure inputs, separated AQI scales, removed linear synthetic AQI and corrected fractional sub-index bands.
- Joined weather by timestamp, corrected timezone fallback and regional seasonal assumptions, prevented stale city results, and refreshed data independently of seasonal requests.
- Repaired tour persistence and onboarding controls; exposed duration, transport and sensor inputs.
- Validated API/local storage profiles; minimized model grounding, added timeouts/process-local limits and safe errors.
- Updated vulnerable dependencies; repaired local .env loading and secret ignore rules. Added unexecuted CI/deployment preparation.

## Release blockers
A compelling local demonstration is available, but a legitimate GenAI competition submission still needs a real authorized Gemini call and a publicly accessible preview. The user's Cloud Run goal additionally requires a successful container/deployment test. No Docker/gcloud tooling or authorized credentials were available. Publishing, billing and submitting require participant approval. Confirm private portal rules and authentic Antigravity provenance before claiming compliance.

The strongest defensible differentiator is explainable, individually constrained family planning with visible repair after changing conditions—not a globally optimized household route planner or medical prediction system. See SUBMISSION_PACKAGE.md for accurate narration.
