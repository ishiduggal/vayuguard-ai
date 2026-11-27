# Data and assumptions
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api): modeled CAMS pollution, not a nearby regulatory station measurement. PM2.5 uses µg/m³. US AQI remains separate from European AQI.
- [Open-Meteo weather API](https://open-meteo.com/en/docs): modeled hourly weather. Weather joins require matching timestamps. Historical weather summaries do not prove future seasonal pollution.
- The displayed CPCB-style PM2.5 sub-index is illustrative, derived from an hourly modeled concentration; it is not official 24-hour Indian NAQI.
- Fallback pollution curves and spike simulations are synthetic. No AQI is invented by multiplying PM2.5.
- Exposure scores are relative planning estimates using assumed exertion/shielding factors, not measured inhaled dose, health risk percentages or clinically validated benefits.
- Indoor air is unknown without an optional user-entered reading. Even that reading is user reported and may be stale or uncalibrated.
- Emissions scenarios assume travel factors, a five-day week and bounded distance shifts. They are illustrative CO2 estimates, not audited CO2e savings or verified household impact. Trip-sharing suggestions have no verified avoided kilometres.
