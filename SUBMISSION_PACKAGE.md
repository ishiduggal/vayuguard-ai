# Submission drafts — do not publish before release gates pass
## Product description
VayuGuard AI helps a family translate modeled air pollution and weather into practical daily plans. Each member's reported sensitivities, waking hours, commitments, activity duration and travel mode shape a deterministic routine. A visible Plan Repair view explains changes after conditions change. Household trip-sharing suggestions identify conversations worth having without inventing route feasibility or savings. Indoor guidance distinguishes routine airing from essential cooking ventilation. Gemini can explain the resulting plans; labeled fallback keeps the prototype usable when unavailable.

## 90-second demonstration outline
0–15s: “An AQI number cannot tell five different people how to arrange their day.” Load the demo and show modeled-data provenance.
15–35s: Compare members, then show fixed versus flexible routines and why decisions differ.
35–50s: Simulate a spike. Show actual before/after changes; explicitly identify the simulation.
50–65s: Show an unconfirmed trip-sharing candidate and ventilation guidance.
65–80s: Ask the assistant why a routine changed. Only say Gemini answered if the live response confirms it.
80–90s: “This is transparent planning support, not a diagnosis or a claim of measured health benefits.” Show repository and deployed preview after verification.

## LinkedIn draft
I built VayuGuard AI for PromptWars' Urban Air Quality Assistant challenge: a family planning prototype that asks what an air-quality number means for each person's real day.

The most interesting work was making the decisions honest: respecting fixed commitments, considering sensitivities and activity duration, showing why a changed forecast repairs a plan, and labeling uncertain data and estimates. Household coordination proposes possibilities rather than claiming trips or emissions were saved.

The project uses modeled environmental data, deterministic TypeScript planning and an optional Gemini explanation layer. It does not diagnose conditions. AI-assisted implementation and independent verification are documented in the repository.

[Insert verified repository, deployed preview and demo links. Confirm official tags in the portal before publication.]

## Technical blog draft
### From air-quality numbers to a family's daily decisions
A single pollution reading hides different needs: a fixed school departure, a flexible walk, a sensitive older adult or a cooking obligation. VayuGuard starts with these constraints instead of asking everyone to interpret the same dashboard.

The planning engine evaluates available hourly windows, averages pollution across activity duration, preserves commitments and changes outdoor recommendations according to reported sensitivity and conditions. It is a greedy heuristic, and states when a feasible slot cannot be found. Exposure indices are illustrative, not clinical outcomes.

Plan Repair runs the engine again and compares results. A simulated spike makes this visible during a demo without pretending synthetic data are real. The household sharing feature identifies nearby time candidates; routes and seating remain for the household to confirm.

Open-Meteo supplies modeled pollution and weather. Missing data remain unknown, and fallback data are labeled synthetic. Gemini receives minimized structured context to explain the plan; it does not decide the schedule. The local fallback is explicitly identified.

Independent review added regression coverage for duration, conflicts, urgent symptoms, ventilation, privacy, malformed requests and repair behavior. Thirty-six tests and a production build passed locally. Live Gemini, container deployment and public preview require separate verification; update this paragraph only after recording that evidence.

The next steps are clinical review, broader accessibility/localization testing and route-aware coordination. The goal is useful, explainable daily planning with uncertainty visible throughout.
