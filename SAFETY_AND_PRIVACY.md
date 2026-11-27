# Safety and privacy
The app asks about reported conditions and symptoms; it does not diagnose, prescribe, change medication or determine whether outdoor activity is medically safe. Severe breathing symptoms trigger immediate care guidance and pause routine optimization. Keyword recognition is incomplete and must not be relied on for emergency triage.

Higher sensitivity, high overall AQI, PM2.5, heat, rain and wind can change recommendations. These prototype thresholds and exposure factors are conservative design heuristics, not individualized clinical advice. Essential combustion ventilation must not be blocked. No respirator is recommended for children under two; fit and clinician advice matter for children.

Reference: [EPA smoke exposure guidance](https://www.epa.gov/wildfires/reduce-your-smoke-exposure). A clinician has not reviewed this application.

Household profiles remain in browser local storage, which is neither encrypted nor private from another user of the same browser. The assistant sends the question, location, age group and structured sensitivity/routine context to the backend. The UI strips names and free-text medical notes before transmission. The server minimizes grounding context before calling Google, with storage disabled in the request. Free text typed into the question can still contain personal information; do not enter identifiers or private medical details. Hosting/provider logs and retention remain deployment concerns.

The AI is explanation-only by design, but model output can still be wrong. No live Gemini safety evaluation was completed. Schema validation and process-local throttles are implemented; this is not a security certification or a production privacy review.
