import type {
  EnvironmentBundle,
  MonthlyPreparednessEntry,
  SeasonalOutlookResult,
} from '../shared/types.js';

export interface MonthlyHistoricalStats {
  monthIndex: number;
  medianPm25: number;
  p90Pm25: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PUNJAB_NORTH_INDIA_PATTERNS: Array<{
  seasonTag: string;
  typicalLevel: MonthlyPreparednessEntry['typicalLevel'];
  keyDrivers: string;
  prep: string[];
}> = [
  {
    seasonTag: 'Peak Winter Inversion & Fog',
    typicalLevel: 'severe',
    keyDrivers: 'Cold calm nights, very shallow boundary layer, morning fog trapping local traffic, heating & biomass smoke.',
    prep: ['Keep N95 masks ready for morning school/office runs', 'Check bedroom door sealing & wet-mopping routine', 'Shift outdoor exercise indoors or to midday warmth'],
  },
  {
    seasonTag: 'Late Winter Transition',
    typicalLevel: 'elevated',
    keyDrivers: 'Gradual warming improves midday mixing, though chilly mornings still show occasional haze.',
    prep: ['Verify morning temperature before asthma walks', 'Air rooms during afternoon sun', 'Review clinician allergy/asthma action notes'],
  },
  {
    seasonTag: 'Spring Dispersion',
    typicalLevel: 'moderate',
    keyDrivers: 'Stronger daytime thermal mixing and brisk winds typically disperse surface particulates faster.',
    prep: ['Good window to service AC/purifier pre-filters', 'Monitor pollen/dust if allergies are reported'],
  },
  {
    seasonTag: 'Pre-Monsoon Dry Dust',
    typicalLevel: 'moderate',
    keyDrivers: 'Dry soils, rising temperatures, and occasional regional dust winds elevate coarse PM10.',
    prep: ['Keep damp-dusting routine during dusty afternoons', 'Prefer morning hours before afternoon dust gusts'],
  },
  {
    seasonTag: 'Summer Dust & Heat',
    typicalLevel: 'elevated',
    keyDrivers: 'Pre-monsoon dust storms (andhi) and peak ozone during intense afternoon sunlight.',
    prep: ['Schedule outdoor walks early before heat & ozone peak', 'Watch dust forecasts for allergy-sensitive members'],
  },
  {
    seasonTag: 'Early Monsoon Shift',
    typicalLevel: 'moderate',
    keyDrivers: 'Pre-monsoon dust early in month transitioning toward humid pre-rain relief.',
    prep: ['Keep asthma triggers dry and ventilated', 'Check local humidity and thunderstorm alerts'],
  },
  {
    seasonTag: 'Monsoon Washout',
    typicalLevel: 'lower',
    keyDrivers: 'Frequent rain scavenges airborne particulates; generally the cleanest particulate season.',
    prep: ['Prevent indoor dampness and mold with dry exhaust', 'Enjoy outdoor family routines on clear post-rain hours'],
  },
  {
    seasonTag: 'Peak Monsoon',
    typicalLevel: 'lower',
    keyDrivers: 'Wet deposition keeps PM2.5/PM10 relatively suppressed across most days.',
    prep: ['Maintain mold-free bedroom ventilation', 'Service HEPA filters or N95 stock ahead of October'],
  },
  {
    seasonTag: 'Monsoon Retreat',
    typicalLevel: 'moderate',
    keyDrivers: 'Rain recedes and wind speeds begin slowing late in the month.',
    prep: ['Restock N95/KN95 masks before October price spikes', 'Check exhaust fans and kitchen chimneys'],
  },
  {
    seasonTag: 'Post-Monsoon Transition & Harvest Window',
    typicalLevel: 'elevated',
    keyDrivers: 'Calm winds, cooling nights, festive fireworks, regional transport, and seasonal crop-residue burning windows across parts of Punjab/Haryana.',
    prep: ['Enable daily afternoon-only window airing habit', 'Prepare indoor play & walk alternatives', 'Verify asthma reliever refills with clinician'],
  },
  {
    seasonTag: 'Severe Smog & Inversion Onset',
    typicalLevel: 'severe',
    keyDrivers: 'Rapid night cooling traps regional smoke plumes (including seasonal agricultural burning when winds align), urban traffic, and construction dust in a shallow boundary layer.',
    prep: ['Activate Household Conflict Solver to cut solo commutes', 'Keep sensitive members indoors during dawn/dusk', 'Use wet mopping and pause indoor incense'],
  },
  {
    seasonTag: 'Winter Fog & Cold Stagnation',
    typicalLevel: 'severe',
    keyDrivers: 'Low temperatures, high morning humidity/fog, domestic heating, and stagnant dispersion.',
    prep: ['Protect cold-air-sensitive members with scarves/masks', 'Keep afternoon midday window for brief errands', 'Monitor Plan Repair alerts for evening spikes'],
  },
];

export function buildSeasonalOutlook(
  env: EnvironmentBundle,
  historicalMonths?: MonthlyHistoricalStats[],
): SeasonalOutlookResult {
  const cityName = env.location.name;
  const isNorthIndia =
    /india/i.test(env.location.country) && /punjab|chandigarh|delhi|haryana|uttar pradesh|rajasthan/i.test(env.location.state);

  const currentPm = env.current.pm25 !== null ? `${Math.round(env.current.pm25)} µg/m³` : 'unavailable';
  const currentAqi = env.current.usAqi !== null ? `${Math.round(env.current.usAqi)} US AQI` : 'unavailable';
  const currentBlh =
    env.current.boundaryLayerHeightM !== null ? `${Math.round(env.current.boundaryLayerHeightM)} m mixing layer` : 'dispersion unavailable';

  const currentObservationSummary = `Current Snapshot (${env.dataKind === 'fallback_offline' ? 'Offline Fallback' : env.dataKind === 'simulated_scenario' ? 'Simulated Scenario' : 'Modeled Nowcast'}): PM2.5 ${currentPm}, ${currentAqi}, ${currentBlh}, ${env.current.windSpeedKmh !== null ? `wind ${Math.round(env.current.windSpeedKmh)} km/h` : 'wind N/A'}.`;

  const peakHour = [...env.hourly]
    .filter((h) => h.pm25 !== null)
    .sort((a, b) => (b.pm25 ?? -1) - (a.pm25 ?? -1))[0];
  const cleanestHour = [...env.hourly]
    .filter((h) => h.pm25 !== null)
    .sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999))[0];

  const shortTermForecastSummary =
    peakHour && cleanestHour
      ? `Daily modeled schedule (${env.hourly[0]?.time.slice(0, 10)}): Modeled PM2.5 ranges from ~${Math.round(cleanestHour.pm25 ?? 0)} µg/m³ (around ${cleanestHour.hour}:00) to ~${Math.round(peakHour.pm25 ?? 0)} µg/m³ (around ${peakHour.hour}:00). Short-term hourly forecasts carry higher confidence than multi-day estimates.`
      : 'Short-term hourly forecast range is partially unavailable; check fresh forecast updates.';

  const hasRealHistory = Boolean(historicalMonths && historicalMonths.length >= 6);

  const calendar: MonthlyPreparednessEntry[] = MONTH_NAMES.map((monthName, idx) => {
    const pattern = isNorthIndia ? PUNJAB_NORTH_INDIA_PATTERNS[idx] : { seasonTag: 'Local seasonal guidance unavailable', typicalLevel: 'moderate' as const, keyDrivers: 'Consult local seasonal advisories; North India patterns are not applied to this location.', prep: ['Check current local forecasts'] };
    const hist = historicalMonths?.find((m) => m.monthIndex === idx);

    let typicalLevel = pattern.typicalLevel;
    if (hist) {
      if (hist.medianPm25 >= 110) typicalLevel = 'severe';
      else if (hist.medianPm25 >= 65) typicalLevel = 'elevated';
      else if (hist.medianPm25 >= 35) typicalLevel = 'moderate';
      else typicalLevel = 'lower';
    }

    return {
      monthIndex: idx,
      monthName,
      seasonTag: pattern.seasonTag,
      typicalLevel,
      medianPm25UgM3: hist ? Math.round(hist.medianPm25) : null,
      p90Pm25UgM3: hist ? Math.round(hist.p90Pm25) : null,
      dataBasis: hist ? 'historical_modeled_cams' : 'regional_climatology_guidance',
      keyDrivers: pattern.keyDrivers,
      uncertaintyNote:
        'Historical seasonal tendency only — does NOT predict exact fog, wind shifts, or smog dates months in advance.',
      preparationChecklist: pattern.prep,
    };
  });

  const historicalPatternSummary = hasRealHistory
    ? `12-Month Historical Modeled Pattern (Open-Meteo CAMS Archive for ${cityName}): Monthly medians and p90 values summarize the available historical data; no seasonal trend is inferred automatically. Individual years vary with rainfall, wind corridors, and regional emission controls.`
    : `Regional Seasonal Guidance (${isNorthIndia ? 'Punjab & Indo-Gangetic Plain' : 'Indian Urban Climatology'}): Live multi-month archive was unavailable, so monthly cards show documented seasonal tendencies without fabricated numeric charts.`;

  const cropBurningContextNote = isNorthIndia
    ? 'Regional Attribution Note: In Punjab and northern India during October–November, regional crop-residue burning can combine with falling night temperatures and calm winds to trap smoke near the ground. However, VayuGuard AI never attributes a specific day’s local pollution solely to crop burning without local source evidence — urban traffic, road dust, brick kilns, and domestic combustion also contribute significantly.'
    : 'Regional Attribution Note: Seasonal pollution reflects a mix of meteorology (temperature inversions, wind speed) and local urban/regional sources.';

  return {
    cityName,
    regionLabel: `${env.location.state}, ${env.location.country}`,
    currentObservationSummary,
    shortTermForecastSummary,
    historicalPatternSummary,
    cropBurningContextNote,
    calendar,
    sourceNote: hasRealHistory
      ? 'Historical monthly medians & 90th percentiles aggregated from 12 months of Open-Meteo CAMS modeled hourly PM2.5.'
      : 'Seasonal calendar uses documented regional meteorological guidance (no fabricated monthly readings).',
  };
}
