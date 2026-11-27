import type {
  ConflictSolverResult,
  EnvironmentBundle,
  GreenImpactResult,
  HouseholdProfile,
} from '../shared/types.js';

/**
 * Documented illustrative Indian urban emission factors:
 * - Passenger car (petrol/diesel fleet average): ~155 g CO2/km, ~0.018 g exhaust PM2.5/km, ~0.25 g NOx/km
 * - Motorized two-wheeler: ~45 g CO2/km, ~0.015 g PM2.5/km, ~0.12 g NOx/km
 * - Urban bus (per passenger-km): ~28 g CO2/pkm, ~0.004 g PM2.5/pkm, ~0.09 g NOx/pkm
 * Sources: India GHG Program / ARAI / CPCB emission factor literature (illustrative averages).
 */
const CAR_CO2_G_PER_KM = 155;
const CAR_PM_G_PER_KM = 0.018;
const CAR_NOX_G_PER_KM = 0.25;


const TRANSIT_CO2_G_PER_PKM = 28;

export function calculateGreenImpact(
  household: HouseholdProfile,
  conflictResult: ConflictSolverResult,
  env: EnvironmentBundle,
  weeklyIdlingMinutesAvoided = 25,
): GreenImpactResult {
  const dailyCarKm = household.members.reduce((sum, m) => {
    const memberCarKm = m.activities
      .filter((a) => a.transportMode === 'car')
      .reduce((s, a) => s + (a.tripDistanceKm ?? 5) * 2, 0);
    return sum + memberCarKm;
  }, 0);

  const weeklyBaselineCarKm = Math.round(dailyCarKm * 5); // 5 weekday commute days
  const dailyAvoidedCarKm = Math.min(dailyCarKm, conflictResult.totalAvoidedKm * 2); // round-trip equivalent
  const weeklyAvoidedTripKm = Math.round(dailyAvoidedCarKm * 4); // ~4 combined trip days/week

  // Public transit swap estimate for 2 non-sensitive commute days/week if accessible
  const hasTransitCandidate = household.resources.hasPublicTransitAccess && dailyCarKm > 0;
  const transitShiftKmPerWeek = hasTransitCandidate ? Math.min(20, Math.round(weeklyBaselineCarKm * 0.2)) : 0;

  const weeklyOptimizedCarKm = Math.max(0, weeklyBaselineCarKm - weeklyAvoidedTripKm - transitShiftKmPerWeek);

  weeklyIdlingMinutesAvoided = dailyCarKm > 0 ? Math.max(0, Math.min(90, weeklyIdlingMinutesAvoided)) : 0;

  // CO2 savings (GHG)
  const tripChainCo2Kg = (weeklyAvoidedTripKm * CAR_CO2_G_PER_KM) / 1000;
  const transitNetCo2Kg =
    (transitShiftKmPerWeek * (CAR_CO2_G_PER_KM - TRANSIT_CO2_G_PER_PKM)) / 1000;
  // Idling petrol/diesel car burns ~0.7 L/hr (~1,610 g CO2/hr = ~26.8 g CO2/min)
  const idlingCo2Kg = (weeklyIdlingMinutesAvoided * 26.8) / 1000;

  const weeklyCo2SavedKg = Number((tripChainCo2Kg + transitNetCo2Kg + idlingCo2Kg).toFixed(1));

  // Local air pollutant savings (exhaust PM2.5 & NOx) — explicitly separated from GHG CO2!
  const totalKmReplaced = weeklyAvoidedTripKm + transitShiftKmPerWeek * 0.7;
  const weeklyLocalPmExhaustSavedG = Number(
    (totalKmReplaced * CAR_PM_G_PER_KM + (weeklyIdlingMinutesAvoided / 60) * 0.12).toFixed(2),
  );
  const weeklyLocalNoxSavedG = Number(
    (totalKmReplaced * CAR_NOX_G_PER_KM + (weeklyIdlingMinutesAvoided / 60) * 3.5).toFixed(1),
  );

  // Safety guard: NEVER promote walking/cycling purely for emissions reduction during unhealthy PM2.5
  const currentPm25 = env.current.pm25 ?? 120;
  const activeTravelBlockedBySmog = currentPm25 > 35 || (env.current.usAqi ?? 999) > 100 || env.isStale;

  const safetyTradeOffNote = activeTravelBlockedBySmog
    ? `Exposure-first safety rule active (PM2.5 ~${Math.round(currentPm25)} µg/m³): VayuGuard AI does NOT recommend switching to walking or cycling for emissions savings during polluted hours because higher breathing rates outdoors increase particulate intake. Prioritize combined enclosed trips, carpooling, and engine-off waiting instead.`
    : `PM2.5 is currently lower (~${Math.round(currentPm25)} µg/m³): check each member’s routine, weather and local conditions before considering active travel.`;

  const actions: GreenImpactResult['actions'] = [
    {
      id: 'green-trip-chaining',
      title: 'Combine school/office runs with grocery errands',
      co2SavedKgPerWeek: Number(tripChainCo2Kg.toFixed(1)),
      localExhaustNote: `Cuts ${weeklyAvoidedTripKm} km/wk of cold-start urban driving (~${(weeklyAvoidedTripKm * CAR_NOX_G_PER_KM).toFixed(1)} g NOx avoided).`,
      exposureSafetyStatus: 'safe_now',
    },
    {
      id: 'green-no-idling',
      title: 'Switch off engine during school-gate & market waiting',
      co2SavedKgPerWeek: Number(idlingCo2Kg.toFixed(1)),
      localExhaustNote: `Avoids ~${weeklyIdlingMinutesAvoided} min/wk of stationary tailpipe fumes right where children board.`,
      exposureSafetyStatus: 'safe_now',
    },
  ];

  if (hasTransitCandidate) {
    actions.push({
      id: 'green-transit-carpool',
      title: 'Shift selected commutes to metro/AC bus or family carpool',
      co2SavedKgPerWeek: Number(transitNetCo2Kg.toFixed(1)),
      localExhaustNote: `Reduces per-person exhaust footprint while keeping riders shielded from open two-wheeler dust (use N95 mask at stops).`,
      exposureSafetyStatus: activeTravelBlockedBySmog ? 'use_transit_or_carpool_instead' : 'safe_now',
    });
  } else {
    actions.push({
      id: 'green-carpool-tw',
      title: 'Consolidate solo two-wheeler + car corridors when smog spikes',
      co2SavedKgPerWeek: 0,
      localExhaustNote: 'Cuts solo tailpipe exhaust and lowers rider exposure to road-level PM2.5.',
      exposureSafetyStatus: 'use_transit_or_carpool_instead',
    });
  }

  return {
    weeklyBaselineCarKm,
    weeklyOptimizedCarKm,
    weeklyCo2SavedKg,
    weeklyLocalPmExhaustSavedG,
    weeklyLocalNoxSavedG,
    activeTravelBlockedBySmog,
    safetyTradeOffNote,
    methodologyNote:
      'Hypothetical weekly scenario, not measured savings: assumes 5 travel days, a 20% car-to-transit shift capped at 20 km if transit is available, and the selected idling minutes. Unconfirmed trip candidates earn zero savings. Unsourced illustrative factors (~155 g CO2/km, ~0.018 g exhaust PM2.5/km, ~0.25 g NOx/km). Greenhouse gases (CO2) are reported separately from local exhaust pollutants (PM2.5, NOx).',
    actions,
  };
}
