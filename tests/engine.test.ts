import { describe, expect, it } from 'vitest';
import {
  buildIndoorAirPlan,
  buildMemberPassport,
  buildSeasonalOutlook,
  buildSimulatedSpikeEnvironment,
  calculateExposureProxy,
  calculateGreenImpact,
  checkSymptomSafetyGuidance,
  compareForecastsAndRepair,
  solveHouseholdConflicts,
} from '../src/engine/index.js';
import { computeIllustrativeCpcbPm25SubIndex } from '../src/shared/aqi.js';
import {
  buildOfflineFallbackEnvironment,
  createPatialaDemoHousehold,
  PRESET_INDIAN_CITIES,
} from '../src/shared/presets.js';
import type { EnvironmentBundle } from '../src/shared/types.js';

function makeSevereAllDayEnv(): EnvironmentBundle {
  const base = buildOfflineFallbackEnvironment(PRESET_INDIAN_CITIES[0]);
  return {
    ...base,
    dataKind: 'modeled_forecast',
    isStale: false,
    staleReason: undefined,
    hourly: base.hourly.map((h) => ({
      ...h,
      pm25: 195,
      pm10: 240,
      usAqi: 245,
      boundaryLayerHeightM: 45,
    })),
    current: { ...base.current, pm25: 195, pm10: 240, usAqi: 245, boundaryLayerHeightM: 45 },
  };
}

describe('Deterministic Core Engines', () => {
  it('generates 5 genuinely distinct passports for the Patiala demo family', () => {
    const household = createPatialaDemoHousehold();
    const env = buildOfflineFallbackEnvironment(household.location);
    const passports = household.members.map((m) =>
      buildMemberPassport(m, env, household.resources),
    );

    expect(passports).toHaveLength(5);
    const uniqueOutlooks = new Set(passports.map((p) => p.todayOutlook));
    expect(uniqueOutlooks.size).toBe(5);

    // Child's fixed 8 AM school must NEVER be moved to afternoon
    const child = passports.find((p) => p.memberId === 'member-child')!;
    const schoolItem = child.timeline.find((t) => t.category === 'school')!;
    expect(schoolItem.recommendedHour).toBe(8);
    expect(schoolItem.flexibility).toBe('fixed');

    // Father with asthma + 6 AM walk must NOT blindly keep 6 AM winter inversion walk
    const father = passports.find((p) => p.memberId === 'member-father')!;
    const walkItem = father.timeline.find((t) => t.category === 'morning_walk')!;
    expect(walkItem.recommendedHour).not.toBe(6);
  });

  it('never labels any outdoor window safe when pollution stays high all day', () => {
    const household = createPatialaDemoHousehold();
    const severeEnv = makeSevereAllDayEnv();
    const passports = household.members.map((m) =>
      buildMemberPassport(m, severeEnv, household.resources),
    );

    for (const p of passports) {
      for (const item of p.timeline) {
        if (item.flexibility === 'flexible' && item.isOutdoorOriginal) {
          expect(item.isOutdoorRecommended).toBe(false);
          expect(item.indoorAlternativeUsed).toBe(true);
        }
      }
    }
  });

  it('triggers urgent-care guidance and pauses routine optimization when severe breathing difficulty is reported', () => {
    const household = createPatialaDemoHousehold();
    household.members[0].sensitivities.urgentSymptomsReported = true;
    const env = buildOfflineFallbackEnvironment(household.location);
    const father = buildMemberPassport(household.members[0], env, household.resources);

    expect(father.urgentCareTriggered).toBe(true);
    expect(father.precautionTier).toBe('stay_indoors');
    expect(father.urgentCareMessage).toContain('108');
    expect(father.timeline[0].suggestedAction.toLowerCase()).toContain('urgent medical care');

    const textCheck = checkSymptomSafetyGuidance('My father has fever and severe breathing difficulty');
    expect(textCheck.urgentCareRequired).toBe(true);
    expect(textCheck.feverMentioned).toBe(true);
    expect(textCheck.safetyMessages.some((m) => m.includes('Fever is not a routine'))).toBe(true);
  });

  it('coordinates household trips in Family Conflict Solver and computes avoidance & exposure', () => {
    const household = createPatialaDemoHousehold();
    const env = buildOfflineFallbackEnvironment(household.location);
    const passports = household.members.map((m) =>
      buildMemberPassport(m, env, household.resources),
    );
    const conflict = solveHouseholdConflicts(household, passports, env);

    expect(conflict.combinedTrips.length).toBeGreaterThan(0);
    expect(conflict.totalAvoidedKm).toBe(0);
    expect(conflict.totalCoordinatedExposureProxyUgHr).not.toBeNull();
    expect(conflict.totalOriginalExposureProxyUgHr).not.toBeNull();
    expect(conflict.totalCoordinatedExposureProxyUgHr!).toBeLessThan(
      conflict.totalOriginalExposureProxyUgHr!,
    );
  });

  it('detects affected routines during simulated forecast spike via Plan Repair', () => {
    const household = createPatialaDemoHousehold();
    const baseEnv = buildOfflineFallbackEnvironment(household.location);
    // Make afternoon clean in baseEnv so evening/afternoon activities were outdoors first
    const cleanBase: EnvironmentBundle = {
      ...baseEnv,
      hourly: baseEnv.hourly.map((h) =>
        h.hour >= 14 && h.hour <= 20 ? { ...h, pm25: 48, usAqi: 130, boundaryLayerHeightM: 600 } : h,
      ),
    };
    const spikedEnv = buildSimulatedSpikeEnvironment(cleanBase);
    const repair = compareForecastsAndRepair(household, cleanBase, spikedEnv);

    expect(repair.hasChanges).toBe(true);
    expect(repair.changes.length).toBeGreaterThan(0);
    expect(repair.affectedMemberNames.length).toBeGreaterThan(0);
  });

  it('calculates transparent exposure proxy and separates GHG CO2 from local exhaust in Green Impact', () => {
    const household = createPatialaDemoHousehold();
    const env = buildOfflineFallbackEnvironment(household.location);
    const proxyOutdoor = calculateExposureProxy({
      pm25: 100,
      durationMinutes: 60,
      intensity: 'vigorous',
      isOutdoor: true,
      resources: household.resources,
    });
    const proxyIndoor = calculateExposureProxy({
      pm25: 100,
      durationMinutes: 60,
      intensity: 'low',
      isOutdoor: false,
      resources: household.resources,
    });
    expect(proxyOutdoor).toBe(240);
    expect(proxyIndoor).toBe(60);

    const passports = household.members.map((m) =>
      buildMemberPassport(m, env, household.resources),
    );
    const conflict = solveHouseholdConflicts(household, passports, env);
    const green = calculateGreenImpact(household, conflict, env, 30);

    expect(green.weeklyCo2SavedKg).toBeGreaterThan(0);
    expect(green.weeklyLocalPmExhaustSavedG).toBeGreaterThan(0);
    expect(green.weeklyLocalNoxSavedG).toBeGreaterThan(0);
    // Current fallback PM2.5 > 90 -> active travel must be blocked for safety!
    expect(green.activeTravelBlockedBySmog).toBe(true);
    expect(green.safetyTradeOffNote).toContain('does NOT recommend switching to walking or cycling');
  });

  it('enforces indoor air safety rules: combustion ventilation, honest sensor note, and outdoor check', () => {
    const household = createPatialaDemoHousehold();
    const severeEnv = makeSevereAllDayEnv();
    const indoor = buildIndoorAirPlan(household.resources, severeEnv);

    expect(indoor.safeToOpenWindowsNow).toBe(false);
    expect(indoor.combustionSafetyWarning).toContain('exhaust');
    expect(indoor.indoorMeasurementNote).toContain('does not claim to measure');
    expect(indoor.recommendations.some((r) => r.tier === 'free')).toBe(true);
  });

  it('marks illustrative CPCB PM2.5 sub-index explicitly as non-official', () => {
    const sub = computeIllustrativeCpcbPm25SubIndex(160);
    expect(sub).not.toBeNull();
    expect(sub!.isOfficialStationNaqi).toBe(false);
    expect(sub!.category).toBe('Very Poor');
    expect(sub!.caveat).toContain('24-hour');
  });

  it('separates seasonal outlook layers and handles missing historical data cleanly', () => {
    const env = buildOfflineFallbackEnvironment(PRESET_INDIAN_CITIES[0]);
    const seasonal = buildSeasonalOutlook(env, []);
    expect(seasonal.calendar).toHaveLength(12);
    expect(seasonal.calendar[10].dataBasis).toBe('regional_climatology_guidance');
    expect(seasonal.calendar[10].medianPm25UgM3).toBeNull();
    expect(seasonal.cropBurningContextNote).toContain('never attributes');
  });
});
