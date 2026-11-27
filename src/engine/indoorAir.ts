import { formatHourLabel } from '../shared/aqi.js';
import type {
  EnvironmentBundle,
  HouseholdResources,
  IndoorAirPlan,
  IndoorChecklistItem,
  IndoorRecommendation,
} from '../shared/types.js';

export function buildIndoorAirPlan(
  resources: HouseholdResources,
  env: EnvironmentBundle,
): IndoorAirPlan {
  const currentPm25 = env.current.pm25;
  const bestHour = [...env.hourly]
    .filter((h) => h.hour >= 10 && h.hour <= 17 && h.pm25 !== null)
    .sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999))[0];

  const safeToOpenWindowsNow = currentPm25 !== null && currentPm25 <= 35 && !env.isStale && env.dataKind !== 'fallback_offline' && (env.current.usAqi ?? 999) <= 100;

  let ventilationWindowAdvice: string;
  if (safeToOpenWindowsNow) {
    ventilationWindowAdvice = `Outdoor PM2.5 is currently moderate (~${Math.round(currentPm25 ?? 0)} µg/m³). A 15–20 minute cross-ventilation window is reasonable right now, especially away from busy roads.`;
  } else if (bestHour && bestHour.pm25 !== null) {
    ventilationWindowAdvice =
      bestHour.pm25 <= 35 && !env.isStale && env.dataKind !== 'fallback_offline'
        ? `Keep main windows closed now (outdoor PM2.5 ~${currentPm25 !== null ? Math.round(currentPm25) : 'N/A'} µg/m³). Air out briefly for 10–15 minutes around ${formatHourLabel(bestHour.hour)} when outdoor PM2.5 dips near ${Math.round(bestHour.pm25)} µg/m³.`
        : `Outdoor air remains elevated even during afternoon dispersion (~${Math.round(bestHour.pm25)} µg/m³ at ${formatHourLabel(bestHour.hour)}). Keep windows mostly shut and use brief kitchen/bath exhaust only to clear indoor cooking fumes and moisture — never seal combustion areas airtight.`;
  } else {
    ventilationWindowAdvice =
      'Outdoor telemetry is limited. Avoid opening road-facing windows during morning/evening haze; check reliable local air-quality advice before routine window airing. Visible haze alone cannot establish safety.';
  }

  const indoorMeasurementNote =
    resources.hasIndoorSensor && resources.measuredIndoorPm25 !== null
      ? `Using your reported indoor sensor reading: ${Math.round(resources.measuredIndoorPm25)} µg/m³ PM2.5.`
      : 'No indoor PM2.5 sensor is configured — VayuGuard AI does not claim to measure your indoor PM2.5 concentration and bases indoor guidance on outdoor infiltration & household source habits.';

  const combustionSafetyWarning =
    resources.cookingType === 'solid_biomass' || resources.cookingType === 'mixed'
      ? 'Important safety rule: Never seal rooms airtight while cooking with biomass, wood, coal, or gas stoves. Always maintain direct kitchen exhaust or crack a nearby window during active flame cooking to prevent carbon monoxide and NO₂ buildup.'
      : resources.cookingType === 'lpg_gas'
        ? 'Combustion safety: Always run the kitchen exhaust fan or keep kitchen ventilation active while cooking on LPG gas — never block stove ventilation.'
        : undefined;

  const recommendations: IndoorRecommendation[] = [];

  // Free actions first
  recommendations.push({
    id: 'indoor-free-ventilation',
    tier: 'free',
    title: 'Time window airing to afternoon dispersion',
    action: ventilationWindowAdvice,
    reason: 'Avoids pulling peak morning and evening inversion particulates indoors.',
  });

  if (resources.sweepingMethod === 'dry_broom') {
    recommendations.push({
      id: 'indoor-free-wet-mop',
      tier: 'free',
      title: 'Switch from dry broom sweeping to damp mopping',
      action: 'Use a damp cloth or wet mop (pocha) instead of dry sweeping floors and furniture.',
      reason: 'Dry sweeping resuspends settled fine dust and soot back into breathing height.',
    });
  } else {
    recommendations.push({
      id: 'indoor-free-wet-dust',
      tier: 'free',
      title: 'Continue damp mopping & wipe entry sills',
      action: 'Maintain wet mopping and wipe shoe-rack/window ledges with a damp cloth daily.',
      reason: 'Prevents settled outdoor particulate dust from re-entering indoor air.',
    });
  }

  if (resources.usesIncenseOrDhoop) {
    recommendations.push({
      id: 'indoor-free-incense',
      tier: 'free',
      title: 'Pause indoor incense (agarbatti / dhoop) on high-smog days',
      action: 'Move prayer lighting to a ventilated balcony/veranda or pause burning sticks indoors during poor AQI days.',
      reason: 'Incense and dhoop emit high indoor fine particulate spikes in closed rooms.',
    });
  }

  if (resources.indoorSmoking) {
    recommendations.push({
      id: 'indoor-free-smoke',
      tier: 'free',
      title: 'Enforce a strict smoke-free indoor home',
      action: 'Eliminate indoor tobacco smoke completely — opening a window does not protect asthmatic or older members.',
      reason: 'Secondhand and thirdhand smoke sharply compounds outdoor particulate irritation.',
    });
  }

  if (resources.hasExhaustFan) {
    recommendations.push({
      id: 'indoor-free-exhaust',
      tier: 'free',
      title: 'Run kitchen exhaust + cover pans during tadka/frying',
      action: 'Switch on the kitchen exhaust 2 minutes before lighting the stove and keep lids on simmering pots.',
      reason: 'Captures cooking PM2.5 and NO₂ at the source before it spreads to bedrooms.',
      safetyNote: 'Never seal the kitchen airtight while gas/combustion burners are lit.',
    });
  } else {
    recommendations.push({
      id: 'indoor-free-cooking-vent',
      tier: 'free',
      title: 'Crack kitchen cross-ventilation while cooking + cover pans',
      action: 'Keep bedroom doors closed during high-heat frying/tadka and vent the kitchen directly outward.',
      reason: 'Prevents indoor NO₂ and cooking aerosols from accumulating in living spaces.',
      safetyNote: 'Maintain safe airflow whenever a gas or biomass stove is burning.',
    });
  }

  // Low-cost actions
  recommendations.push({
    id: 'indoor-lowcost-door-draft',
    tier: 'low_cost',
    title: 'Seal outer door gaps & use damp curtain/doormat trap',
    action: 'Place rolled towels or affordable weather-stripping under exterior door gaps (keep kitchen/combustion vents unobstructed).',
    reason: 'Reduces passive smog seepage through hallway and balcony door gaps on stagnant nights.',
    safetyNote: 'Do not block gas-geyser vents or active stove ventilation.',
  });

  if (resources.hasAirConditioning) {
    recommendations.push({
      id: 'indoor-lowcost-ac-recirc',
      tier: 'low_cost',
      title: 'Set AC to Recirculate & wash mesh pre-filters weekly',
      action: 'If running AC/fan circulation, select indoor recirculation mode rather than fresh-air intake and rinse dust filters weekly.',
      reason: 'Prevents drawing unfiltered outdoor haze while trapping coarse indoor dust.',
    });
  }

  recommendations.push({
    id: 'indoor-lowcost-masks',
    tier: 'low_cost',
    title: 'Keep fitted N95/KN95 masks at the front door',
    action: 'Use reusable-for-days N95/KN95 respirators (replaced when straps loosen or dirty) for unavoidable morning commutes.',
    reason: 'A well-fitting respirator can reduce particle exposure, but does not remove all gases. Never use masks on children under 2; seek pediatric guidance for older children and clinician advice if breathing is difficult.',
  });

  // Optional equipment purchases (respecting budget flag!)
  if (!resources.hasAirPurifier) {
    recommendations.push({
      id: 'indoor-opt-purifier',
      tier: 'optional_purchase',
      title: resources.limitedBudget
        ? 'Optional (Only if budget allows): Single-bedroom True HEPA purifier'
        : 'Add a True HEPA H13 air purifier for the sleeping room',
      action: resources.limitedBudget
        ? 'Not required to get benefit — prioritize the free/low-cost steps above first. If saving for one device later, one True HEPA unit in the bedroom of the most sensitive member gives the largest overnight clean-air hours.'
        : 'Run a True HEPA H13 purifier sized to the bedroom CADR with doors closed during sleeping hours.',
      reason: 'Creates an 8-hour lower-PM2.5 recovery space overnight without needing whole-home filtration.',
    });
  }

  if (!resources.hasExhaustFan) {
    recommendations.push({
      id: 'indoor-opt-exhaust',
      tier: 'optional_purchase',
      title: 'Optional upgrade: Basic kitchen exhaust fan',
      action: 'Installing a standard wall exhaust fan above the stove removes cooking fumes without relying on opening bedroom windows.',
      reason: 'High impact per rupee for households cooking daily indoors.',
    });
  }

  if (!resources.hasIndoorSensor) {
    recommendations.push({
      id: 'indoor-opt-sensor',
      tier: 'optional_purchase',
      title: 'Optional: Laser-scattering indoor PM2.5 monitor',
      action: 'Only needed if you want real-time verification of cooking spikes and window-opening timing.',
      reason: 'Turns guesswork into verified indoor measurements.',
    });
  }

  const dailyChecklist: IndoorChecklistItem[] = [
    {
      id: 'chk-exhaust-cooking',
      label: 'Run exhaust / vent kitchen during high-heat cooking & cover pans',
      tier: 'free',
      timingHint: 'Morning & evening meals',
    },
    {
      id: 'chk-wet-mop',
      label: 'Wet mop floors instead of dry broom sweeping',
      tier: 'free',
      timingHint: 'Mid-morning',
    },
    {
      id: 'chk-window-window',
      label: safeToOpenWindowsNow ? 'Consider brief airing; recheck outdoor conditions first' : 'Defer routine window airing; maintain essential cooking ventilation',
      tier: 'free',
      timingHint: safeToOpenWindowsNow ? 'Brief airing; monitor conditions' : 'Defer routine airing',
    },
    {
      id: 'chk-no-incense',
      label: 'Keep indoor rooms free of incense, dhoop, and smoke',
      tier: 'free',
      timingHint: 'All day',
    },
    {
      id: 'chk-door-mask',
      label: 'Stage fitted N95/KN95 masks by the door for fixed morning commutes',
      tier: 'low_cost',
      timingHint: 'Before 8 AM departure',
    },
  ];

  return {
    ventilationWindowAdvice,
    safeToOpenWindowsNow,
    indoorMeasurementNote,
    combustionSafetyWarning,
    recommendations,
    dailyChecklist,
  };
}
