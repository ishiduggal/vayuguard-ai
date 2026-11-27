import { buildIndoorAirPlan } from './indoorAir.js';
import { formatHourLabel } from '../shared/aqi.js';
import type {
  ActivityIntensity,
  EnvironmentBundle,
  FamilyMember,
  HourlyEnvironmentPoint,
  HouseholdResources,
  MemberPassport,
  PrecautionTier,
  RoutineActivity,
  TimelineItem,
} from '../shared/types.js';
import {
  determinePrecautionTier,
  evaluateMemberSensitivity,
  precautionTierLabel,
  type SensitivityEvaluation,
} from './safetyRules.js';

const INTENSITY_VENTILATION_FACTOR: Record<ActivityIntensity, number> = {
  low: 1.0,
  moderate: 1.6,
  vigorous: 2.4,
};

/**
 * Computes an illustrative concentration-duration exposure proxy in `µg/m³ · hours` of PM2.5.
 * Uses transparent assumptions:
 * - Outdoor shield factor = 1.0
 * - Indoor shield factor = 0.60 without HEPA purifier, 0.35 with purifier (or actual sensor reading if provided)
 * - Relative exertion scaling = 1.0 (low), 1.6 (moderate), 2.4 (vigorous)
 * NOTE: This is NOT an inhaled dose and does NOT represent a percentage health-risk reduction.
 */
export function calculateExposureProxy(params: {
  pm25: number | null;
  durationMinutes: number;
  intensity: ActivityIntensity;
  isOutdoor: boolean;
  resources: HouseholdResources;
}): number | null {
  const { pm25, durationMinutes, intensity, isOutdoor, resources } = params;
  const effectivePm25 =
    !isOutdoor && resources.hasIndoorSensor && resources.measuredIndoorPm25 !== null
      ? resources.measuredIndoorPm25
      : pm25;

  if (effectivePm25 === null || !Number.isFinite(effectivePm25) || durationMinutes <= 0) {
    return null;
  }

  const hours = durationMinutes / 60;
  const exertionFactor = INTENSITY_VENTILATION_FACTOR[intensity];
  const shieldFactor = isOutdoor
    ? 1.0
    : resources.hasIndoorSensor && resources.measuredIndoorPm25 !== null
      ? 1.0
      : resources.hasAirPurifier
        ? 0.35
        : 0.6;

  return Number((effectivePm25 * hours * exertionFactor * shieldFactor).toFixed(1));
}

function getHourlyPointForHour(hourly: HourlyEnvironmentPoint[], hour: number): HourlyEnvironmentPoint | undefined {
  return hourly.find((p) => p.hour === hour);
}

function averageActivityPoint(hourly: HourlyEnvironmentPoint[], start: number, duration: number): HourlyEnvironmentPoint | undefined {
  const first = getHourlyPointForHour(hourly, start);
  if (!first) return undefined;
  let remaining = duration / 60, offset = 0, pmSum = 0, known = true;
  let worstAqi = first.usAqi;
  while (remaining > 0) {
    const weight = Math.min(1, remaining);
    const point = getHourlyPointForHour(hourly, start + offset);
    if (point?.pm25 == null) known = false; else pmSum += point.pm25 * weight;
    if (point?.usAqi != null) worstAqi = Math.max(worstAqi ?? 0, point.usAqi);
    remaining -= weight; offset++;
  }
  return { ...first, pm25: known ? pmSum / (duration / 60) : null, usAqi: worstAqi };
}

function scoreWindow(
  point: HourlyEnvironmentPoint,
  sensitivity: SensitivityEvaluation,
  activity: RoutineActivity,
): number {
  const pm25Score = point.pm25 ?? 1000;
  const intensityWeight = activity.intensity === 'vigorous' ? 1.35 : activity.intensity === 'moderate' ? 1.15 : 1.0;

  let penalty = pm25Score * sensitivity.multiplier * intensityWeight;

  // Shallow boundary layer height traps ground-level pollutants even if hourly model smooths a spike
  if (point.boundaryLayerHeightM !== null && point.boundaryLayerHeightM < 120) {
    penalty += 18;
  }

  // Cold-air airway sensitivity check
  if (sensitivity.coldAirSensitive && point.temperatureC !== null && point.temperatureC < 13) {
    penalty += (13 - point.temperatureC) * 4;
  }

  // Heavy rain discourages outdoor exercise/walk
  if (activity.isOutdoor && point.precipitationMm !== null && point.precipitationMm > 1.5) {
    penalty += 35;
  }

  // Mild tie-breaker toward user's preferred hour when conditions are nearly identical
  const hourDiff = Math.abs(point.hour - activity.preferredStartHour);
  penalty += hourDiff * 1.2;

  return penalty;
}

function describeConditions(point: HourlyEnvironmentPoint | undefined): string {
  if (!point) return 'Forecast data unavailable for this hour';
  const parts: string[] = [];
  if (point.pm25 !== null) parts.push(`PM2.5 ${Math.round(point.pm25)} µg/m³`);
  if (point.usAqi !== null) parts.push(`US AQI ${Math.round(point.usAqi)}`);
  if (point.temperatureC !== null) parts.push(`${Math.round(point.temperatureC)}°C`);
  if (point.windSpeedKmh !== null) parts.push(`Wind ${Math.round(point.windSpeedKmh)} km/h`);
  if (point.boundaryLayerHeightM !== null) parts.push(`Dispersion ${Math.round(point.boundaryLayerHeightM)} m`);
  return parts.length > 0 ? parts.join(' · ') : 'Limited telemetry';
}

function indoorAlternativeForActivity(activity: RoutineActivity): string {
  switch (activity.category) {
    case 'morning_walk':
      return 'Switch to an indoor hallway walk or gentle mobility, only if comfortable.';
    case 'exercise':
      return 'Replace outdoor workout with indoor bodyweight strength, yoga, or stationary cycling away from open road windows.';
    case 'outdoor_play':
      return 'Keep play indoors (board games, indoor obstacle play, stretching) rather than outdoor ground activity.';
    case 'grocery':
      return 'Combine errands into a single enclosed-vehicle trip or order staples locally instead of an extra walk.';
    case 'ventilation':
      return 'Keep road-facing windows closed for now; run kitchen exhaust only while cooking and air rooms briefly during afternoon dispersion.';
    default:
      return 'Perform this routine indoors with minimal dust disturbance.';
  }
}

function buildPrecautionText(
  tier: PrecautionTier,
  activity: RoutineActivity,
  point: HourlyEnvironmentPoint | undefined,
  sensitivity: SensitivityEvaluation,
  isOutdoorRecommended: boolean,
): string {
  if (sensitivity.urgentCareTriggered) {
    return 'Urgent symptoms flagged: stop activity optimization and seek prompt medical care.';
  }
  const coldNote =
    sensitivity.coldAirSensitive && point?.temperatureC !== null && (point?.temperatureC ?? 99) < 13
      ? ' Cover nose/mouth with a warm scarf or mask against cold air.'
      : '';
  const clinicianSuffix = sensitivity.clinicianNote ? ` Follow clinician note: ${sensitivity.clinicianNote}` : '';

  if (!activity.isOutdoor && !activity.transportMode) return activity.category === 'cooking'
    ? 'Maintain kitchen exhaust and safe ventilation during active cooking; never seal combustion areas airtight.'
    : 'Maintain cleaner indoor air and avoid indoor smoke sources.';
  if (activity.flexibility === 'fixed' && (tier === 'high' || tier === 'stay_indoors')) {
    return `Fixed commitment: wear a well-fitted N95/KN95 mask outdoors if tolerated, minimize roadside waiting/idling, and avoid outdoor PE or vigorous exertion.${coldNote}${clinicianSuffix}`;
  }
  if (!isOutdoorRecommended && activity.isOutdoor) {
    return `Shifted indoors because outdoor particulate levels remain elevated.${clinicianSuffix}`;
  }
  if (tier === 'stay_indoors') {
    return `Minimize outdoor time; keep doors/windows closed except when cooking exhaust is active.${coldNote}${clinicianSuffix}`;
  }
  if (tier === 'high') {
    return `Keep exertion light, shorten outdoor duration, and use a well-fitted N95/KN95 mask near traffic.${coldNote}${clinicianSuffix}`;
  }
  if (tier === 'moderate') {
    return `Prefer lower-traffic streets and pause if coughing or throat irritation starts.${coldNote}${clinicianSuffix}`;
  }
  return `Standard comfort precautions; stay hydrated.${coldNote}`;
}

export function buildMemberPassport(
  member: FamilyMember,
  env: EnvironmentBundle,
  resources: HouseholdResources,
): MemberPassport {
  const sensitivity = evaluateMemberSensitivity(member);
  const hourly = env.hourly;

  const isAwake = (hour: number) => member.wakeHour < member.sleepHour
    ? hour >= member.wakeHour && hour < member.sleepHour
    : hour >= member.wakeHour || hour < member.sleepHour;
  const feasibleHours = hourly.filter(h => isAwake(h.hour));
  const searchPool = feasibleHours;
  const occupied = member.activities.filter(a => a.flexibility === 'fixed')
    .map(a => ({ start: a.preferredStartHour, end: a.preferredStartHour + a.durationMinutes / 60 }));

  // Threshold above which an outdoor window is NOT labeled safe for this member
  const allDayOutdoorCapPm25 = sensitivity.isHighSensitivity ? 35 : 55;

  const timeline: TimelineItem[] = member.activities.map((activity) => {
    const pool = searchPool.filter(h => {
      const end = h.hour + activity.durationMinutes / 60;
      return end <= 24 && isAwake((end - 0.001 + 24) % 24) &&
        !occupied.some(o => h.hour < o.end && end > o.start);
    });
    const noSlot = activity.flexibility === 'flexible' && pool.length === 0;
    const origPoint = averageActivityPoint(hourly, activity.preferredStartHour, activity.durationMinutes);
    const origPm25 = origPoint?.pm25 ?? null;

    let bestPoint = origPoint;
    if (!sensitivity.urgentCareTriggered && activity.flexibility === 'flexible' && pool.length > 0) {
      bestPoint = pool.map(p => averageActivityPoint(hourly, p.hour, activity.durationMinutes)!).reduce((best, candidate) =>
        scoreWindow(candidate, sensitivity, activity) < scoreWindow(best, sensitivity, activity)
          ? candidate
          : best,
      );
    }

    const recHour = bestPoint?.hour ?? activity.preferredStartHour;
    if (activity.flexibility === 'flexible' && !noSlot) occupied.push({ start: recHour, end: recHour + activity.durationMinutes / 60 });
    const recPm25 = bestPoint?.pm25 ?? null;
    const recAqi = bestPoint?.usAqi ?? null;

    const tier = determinePrecautionTier(recPm25, recAqi, sensitivity);

    // Determine whether outdoor activity should move indoors
    const isElevatedAtBestWindow =
      (recPm25 !== null && recPm25 > allDayOutdoorCapPm25) ||
      (recPm25 === null && recAqi !== null && recAqi > 150) ||
      (recPm25 === null && recAqi === null) || tier === 'stay_indoors' ||
      (activity.intensity === 'vigorous' && tier === 'high') ||
      (activity.isOutdoor && ((bestPoint?.temperatureC ?? 20) >= 35 || (bestPoint?.precipitationMm ?? 0) > 1.5 || (bestPoint?.windSpeedKmh ?? 0) > 40));

    const shouldMoveIndoors =
      sensitivity.urgentCareTriggered || noSlot ||
      (activity.isOutdoor && activity.flexibility === 'flexible' && isElevatedAtBestWindow);

    const isOutdoorRecommended = activity.isOutdoor && !shouldMoveIndoors;
    const indoorAlternativeUsed = activity.isOutdoor && shouldMoveIndoors;
    const indoorAlternativeText = indoorAlternativeUsed && !sensitivity.urgentCareTriggered ? indoorAlternativeForActivity(activity) : undefined;

    let suggestedAction = '';
    let reason = '';

    if (sensitivity.urgentCareTriggered) {
      suggestedAction = 'Pause routine and seek urgent medical care immediately';
      reason = 'Severe breathing difficulty was reported for this member.';
    } else if (activity.flexibility === 'fixed' && !activity.isOutdoor && !activity.transportMode) {
      suggestedAction = `Keep indoor routine at ${formatHourLabel(activity.preferredStartHour)}`;
      reason = activity.category === 'cooking' ? 'Maintain kitchen exhaust or ventilation during active cooking; never seal combustion areas.' : 'Indoor routine remains at its fixed time.';
    } else if (activity.flexibility === 'fixed') {
      suggestedAction =
        tier === 'high' || tier === 'stay_indoors'
          ? `Keep ${formatHourLabel(activity.preferredStartHour)} schedule with transit & mask precautions`
          : `Proceed at ${formatHourLabel(activity.preferredStartHour)} as scheduled`;
      reason =
        tier === 'high' || tier === 'stay_indoors'
          ? `This commitment is fixed, and ${origPm25 !== null ? `PM2.5 is ~${Math.round(origPm25)} µg/m³` : 'air quality is elevated'} at ${formatHourLabel(activity.preferredStartHour)}. Focus on enclosed commute and avoiding roadside waiting.`
          : `Fixed commitment aligns with manageable conditions.`;
    } else if (indoorAlternativeUsed) {
      suggestedAction = `Move indoors (${formatHourLabel(recHour)}): ${indoorAlternativeText}`;
      reason =
        recPm25 !== null
          ? `Outdoor conditions require caution at the selected feasible window (PM2.5 ~${Math.round(recPm25)} µg/m³ at ${formatHourLabel(recHour)}), so no outdoor window is labeled safe for ${member.name}.`
          : `Pollutant telemetry is incomplete or elevated, so an indoor option avoids unnecessary exposure.`;
    } else if (recHour !== activity.preferredStartHour) {
      const origTxt = origPm25 !== null ? `${Math.round(origPm25)} µg/m³` : 'higher levels';
      const recTxt = recPm25 !== null ? `${Math.round(recPm25)} µg/m³` : 'lower levels';
      const blhNote =
        bestPoint?.boundaryLayerHeightM && origPoint?.boundaryLayerHeightM && bestPoint.boundaryLayerHeightM > origPoint.boundaryLayerHeightM * 1.5
          ? ' as afternoon mixing layer rises'
          : '';
      suggestedAction = `Shift from ${formatHourLabel(activity.preferredStartHour)} to ${formatHourLabel(recHour)}`;
      reason = `The pollution, weather and schedule score favors ${formatHourLabel(recHour)} (${recTxt} vs ${origTxt} at ${formatHourLabel(activity.preferredStartHour)})${blhNote}.`;
    } else {
      suggestedAction = `Keep at ${formatHourLabel(recHour)}${activity.category === 'ventilation' && (recPm25 ?? 0) > 80 ? ' — keep brief (<10 min) or defer' : ''}`;
      reason = `Your preferred ${formatHourLabel(recHour)} slot is already near the lowest available exposure window.`;
    }

    const missingCount = env.missingFields.length + (recPm25 === null ? 1 : 0);
    const confidenceLabel: TimelineItem['confidenceLabel'] =
      env.dataKind === 'fallback_offline' || missingCount >= 2
        ? 'Low (Incomplete Data)'
        : env.isStale || missingCount === 1
          ? 'Moderate'
          : 'High';

    const dataLimitation =
      env.dataKind === 'simulated_scenario'
        ? 'Simulated forecast change scenario for evaluation.'
        : env.dataKind === 'fallback_offline'
          ? 'Using labeled offline fallback pattern because live forecast API was unreachable.'
          : 'Daily schedule, not a next-24-hour plan. PM2.5 averages the activity duration; AQI uses the worst covered hour. Indoor/cabin shielding is illustrative, not a measurement.';

    const fixedConflict = activity.flexibility === 'fixed' && member.activities.some(a => a.id !== activity.id && a.flexibility === 'fixed' && activity.preferredStartHour < a.preferredStartHour + a.durationMinutes / 60 && activity.preferredStartHour + activity.durationMinutes / 60 > a.preferredStartHour);
    if (fixedConflict && !sensitivity.urgentCareTriggered) {
      suggestedAction = 'Fixed commitments overlap — review your input schedule';
      reason = 'Start times are preserved, but these commitments cannot both fit as entered.';
    } else if (noSlot && !sensitivity.urgentCareTriggered) {
      suggestedAction = 'No feasible non-overlapping slot — edit this routine or defer it';
      reason = 'The activity does not fit around waking hours and other scheduled commitments.';
    } else if (activity.category === 'ventilation' && !sensitivity.urgentCareTriggered) {
      suggestedAction = buildIndoorAirPlan(resources, env).ventilationWindowAdvice;
      reason = 'Ventilation is conditional on outdoor conditions; maintain combustion ventilation while cooking.';
    }

    const exposureResources = activity.transportMode && activity.transportMode !== 'remote'
      ? { ...resources, hasIndoorSensor: false, measuredIndoorPm25: null, hasAirPurifier: false } : resources;
    const openTransport = activity.transportMode === 'two_wheeler' || activity.transportMode === 'walk_cycle';
    const origExposure = calculateExposureProxy({
      pm25: origPm25,
      durationMinutes: activity.durationMinutes,
      intensity: activity.intensity,
      isOutdoor: activity.isOutdoor || openTransport,
      resources: exposureResources,
    });

    const recExposure = calculateExposureProxy({
      pm25: recPm25,
      durationMinutes: activity.durationMinutes,
      intensity: activity.intensity,
      isOutdoor: isOutdoorRecommended || openTransport,
      resources: exposureResources,
    });

    return {
      activityId: activity.id,
      memberId: member.id,
      memberName: member.name,
      title: activity.title,
      category: activity.category,
      flexibility: activity.flexibility,
      originalHour: activity.preferredStartHour,
      recommendedHour: recHour,
      durationMinutes: activity.durationMinutes,
      isOutdoorOriginal: activity.isOutdoor,
      isOutdoorRecommended,
      indoorAlternativeUsed,
      indoorAlternativeText,
      conditionsSummary: describeConditions(bestPoint),
      pm25AtWindow: recPm25,
      usAqiAtWindow: recAqi,
      suggestedAction,
      reason,
      precaution: member.ageGroup === 'infant_toddler' && !sensitivity.urgentCareTriggered
        ? 'Prioritize cleaner indoor air and minimize outdoor exposure. Never put a mask or respirator on a child under 2; ask a pediatric clinician about older toddlers.'
        : buildPrecautionText(tier, activity, bestPoint, sensitivity, isOutdoorRecommended),
      precautionTier: tier,
      confidenceLabel,
      dataLimitation,
      originalExposureProxyUgHr: origExposure,
      recommendedExposureProxyUgHr: noSlot || sensitivity.urgentCareTriggered ? null : recExposure,
    };
  });

  // Sort chronologically by recommendedHour
  timeline.sort((a, b) => a.recommendedHour - b.recommendedHour);

  // Member overall precaution tier = highest severity across current hour & scheduled timeline
  const tierRank: Record<PrecautionTier, number> = {
    low: 0,
    moderate: 1,
    high: 2,
    stay_indoors: 3,
  };
  const currentTier = determinePrecautionTier(env.current.pm25, env.current.usAqi, sensitivity);
  const overallTier = timeline.reduce<PrecautionTier>(
    (worst, item) => (tierRank[item.precautionTier] > tierRank[worst] ? item.precautionTier : worst),
    currentTier,
  );

  const recommendedActivities = timeline
    .filter((t) => !t.indoorAlternativeUsed && (t.precautionTier === 'low' || t.precautionTier === 'moderate'))
    .map((t) => `${t.title} at ${formatHourLabel(t.recommendedHour)}`);

  const activitiesToReconsider = timeline
    .filter((t) => t.indoorAlternativeUsed || t.recommendedHour !== t.originalHour || t.precautionTier === 'stay_indoors')
    .map((t) =>
      t.indoorAlternativeUsed
        ? `${t.title}: ${sensitivity.urgentCareTriggered ? 'paused for urgent care' : 'outdoors -> indoor alternative'}`
        : `${t.title} (${formatHourLabel(t.originalHour)} -> ${formatHourLabel(t.recommendedHour)})`,
    );

  // Best 2 dispersion windows in wake hours
  const sortedCleanHours = [...searchPool]
    .filter((h) => h.pm25 !== null)
    .sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999))
    .slice(0, 2);

  const suggestedTimeWindows =
    sortedCleanHours.length > 0
      ? sortedCleanHours.map((h) =>
          (h.pm25 ?? 999) > allDayOutdoorCapPm25
            ? `${formatHourLabel(h.hour)} (lowest PM2.5 ~${Math.round(h.pm25 ?? 0)} µg/m³, still elevated — keep brief/indoor)`
            : `${formatHourLabel(h.hour)} (relatively cleaner: ~${Math.round(h.pm25 ?? 0)} µg/m³)`,
        )
      : ['Hourly forecast incomplete; prefer midday over stagnant dawn/night hours.'];

  const indoorAlternatives = Array.from(
    new Set(
      timeline
        .filter((t) => t.indoorAlternativeText)
        .map((t) => t.indoorAlternativeText as string),
    ),
  );

  const totalOrig = timeline.length === 0 || timeline.some((t) => t.originalExposureProxyUgHr === null)
    ? null
    : Number(
        timeline.reduce((sum, t) => sum + (t.originalExposureProxyUgHr ?? 0), 0).toFixed(1),
      );
  const totalRec = timeline.length === 0 || timeline.some((t) => t.recommendedExposureProxyUgHr === null)
    ? null
    : Number(
        timeline.reduce((sum, t) => sum + (t.recommendedExposureProxyUgHr ?? 0), 0).toFixed(1),
      );

  const todayOutlook = sensitivity.urgentCareTriggered
    ? 'Urgent care guidance active: severe breathing difficulty reported.'
    : `${precautionTierLabel(overallTier)} for ${member.name} (${member.role}) — current PM2.5 ${env.current.pm25 !== null ? `${Math.round(env.current.pm25)} µg/m³` : 'N/A'}.`;

  return {
    memberId: member.id,
    memberName: member.name,
    role: member.role,
    ageGroup: member.ageGroup,
    precautionTier: overallTier,
    precautionLabel: precautionTierLabel(overallTier),
    urgentCareTriggered: sensitivity.urgentCareTriggered,
    urgentCareMessage: sensitivity.urgentCareMessage,
    todayOutlook,
    sensitivityFactors: sensitivity.factors,
    recommendedActivities:
      sensitivity.urgentCareTriggered ? ['Pause routine activities and seek urgent medical care now.'] : recommendedActivities.length > 0
        ? recommendedActivities
        : ['Focus on low-exertion indoor tasks and essential fixed commitments with mask precautions.'],
    activitiesToReconsider,
    suggestedTimeWindows: sensitivity.urgentCareTriggered ? ['Routine optimization paused for urgent care.'] : suggestedTimeWindows,
    indoorAlternatives:
      sensitivity.urgentCareTriggered ? ['Do not exercise; seek urgent medical care now.'] : indoorAlternatives.length > 0
        ? indoorAlternatives
        : ['Indoor stretching, gentle mobility, or quiet hobbies during peak haze hours.'],
    reasonsSummary:
      sensitivity.factors.join('; ') +
      (env.current.boundaryLayerHeightM !== null && env.current.boundaryLayerHeightM < 120
        ? '. Shallow atmospheric mixing layer traps surface emissions.'
        : '.'),
    forecastUncertainty:
      env.dataKind === 'fallback_offline'
        ? 'Offline fallback curve shown; connect to internet to fetch live Open-Meteo hourly forecast.'
        : `Modeled ${env.forecastHorizonHours}h forecast (${env.source}); actual street-level smoke or traffic plumes can differ.`,
    timeline,
    totalOriginalExposureProxyUgHr: totalOrig,
    totalRecommendedExposureProxyUgHr: totalRec,
  };
}
