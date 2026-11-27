import { formatHourLabel } from '../shared/aqi.js';
import type {
  EnvironmentBundle,
  HouseholdProfile,
  PlanRepairChange,
  PlanRepairReport,
} from '../shared/types.js';
import { buildMemberPassport } from './routineEngine.js';

export function compareForecastsAndRepair(
  household: HouseholdProfile,
  previousEnv: EnvironmentBundle,
  nextEnv: EnvironmentBundle,
): PlanRepairReport {
  const prevPassports = household.members.map((m) => buildMemberPassport(m, previousEnv, household.resources));
  const nextPassports = household.members.map((m) => buildMemberPassport(m, nextEnv, household.resources));

  const changes: PlanRepairChange[] = [];
  const affectedNames = new Set<string>();

  for (let i = 0; i < household.members.length; i++) {
    const prevP = prevPassports[i];
    const nextP = nextPassports[i];
    if (!prevP || !nextP) continue;

    for (const nextItem of nextP.timeline) {
      const prevItem = prevP.timeline.find((t) => t.activityId === nextItem.activityId);
      if (!prevItem) continue;

      const hourChanged = prevItem.recommendedHour !== nextItem.recommendedHour;
      const modeChanged = prevItem.isOutdoorRecommended !== nextItem.isOutdoorRecommended;
      const tierChanged = prevItem.precautionTier !== nextItem.precautionTier;
      const pm25Delta =
        prevItem.pm25AtWindow !== null && nextItem.pm25AtWindow !== null
          ? Math.round(nextItem.pm25AtWindow - prevItem.pm25AtWindow)
          : null;

      const prevOrigPm = previousEnv.hourly.find((h) => h.hour === nextItem.originalHour)?.pm25 ?? null;
      const nextOrigPm = nextEnv.hourly.find((h) => h.hour === nextItem.originalHour)?.pm25 ?? null;
      const origWindowDelta =
        prevOrigPm !== null && nextOrigPm !== null ? Math.round(nextOrigPm - prevOrigPm) : null;

      const significantPm25Jump =
        (pm25Delta !== null && Math.abs(pm25Delta) >= 25) ||
        (origWindowDelta !== null && origWindowDelta >= 40);

      if (hourChanged || modeChanged || tierChanged || significantPm25Jump) {
        affectedNames.add(nextItem.memberName);
        const effectiveDelta =
          pm25Delta !== null && pm25Delta !== 0 ? pm25Delta : origWindowDelta;
        const severity: PlanRepairChange['severity'] =
          nextItem.precautionTier === 'stay_indoors' || (effectiveDelta !== null && effectiveDelta >= 60)
            ? 'urgent'
            : modeChanged || tierChanged
              ? 'important'
              : 'notice';

        const whatParts: string[] = [];
        if (pm25Delta !== null && pm25Delta !== 0) {
          whatParts.push(
            `PM2.5 at recommended window ${pm25Delta > 0 ? 'rose' : 'fell'} by ${Math.abs(pm25Delta)} µg/m³ (${Math.round(prevItem.pm25AtWindow ?? 0)} -> ${Math.round(nextItem.pm25AtWindow ?? 0)} µg/m³)`,
          );
        } else if (origWindowDelta !== null && origWindowDelta >= 40) {
          whatParts.push(
            `PM2.5 at your usual ${formatHourLabel(nextItem.originalHour)} slot surged by +${origWindowDelta} µg/m³ (${Math.round(prevOrigPm ?? 0)} -> ${Math.round(nextOrigPm ?? 0)} µg/m³)`,
          );
        }
        if (tierChanged) {
          whatParts.push(`Precaution tier changed from ${prevItem.precautionTier} to ${nextItem.precautionTier}`);
        }
        if (modeChanged) {
          whatParts.push(nextItem.isOutdoorRecommended ? 'Outdoor window reopened' : 'Shifted from outdoor to indoor alternative');
        }
        if (hourChanged) {
          whatParts.push(
            `Recommended time shifted from ${formatHourLabel(prevItem.recommendedHour)} to ${formatHourLabel(nextItem.recommendedHour)}`,
          );
        }

        changes.push({
          id: `repair-${nextItem.memberId}-${nextItem.activityId}`,
          memberId: nextItem.memberId,
          memberName: nextItem.memberName,
          activityTitle: nextItem.title,
          previousHour: prevItem.recommendedHour,
          previousAction: prevItem.suggestedAction,
          updatedHour: nextItem.recommendedHour,
          updatedAction: nextItem.suggestedAction,
          whatChanged: whatParts.join('; ') || 'Updated environmental conditions.',
          pm25Delta: effectiveDelta,
          suggestedAlternative:
            nextItem.indoorAlternativeText ?? nextItem.precaution,
          severity,
        });
      }
    }
  }

  const affectedMemberNames = Array.from(affectedNames);
  const summary =
    changes.length === 0
      ? 'No scheduled family routines were disrupted by the latest forecast update.'
      : `${changes.length} routine recommendation${changes.length > 1 ? 's' : ''} updated across ${affectedMemberNames.join(', ')} due to changing hourly conditions.`;

  return {
    hasChanges: changes.length > 0,
    detectedAt: new Date().toISOString(),
    summary,
    affectedMemberNames,
    changes,
    notificationLimitation:
      'In-app Plan Repair alerts update whenever forecasts refresh or a scenario changes; background OS push notifications are not active in this web deployment.',
  };
}

/**
 * Generates an explicitly labeled simulated evening/afternoon smog spike scenario
 * for the 60-second judge demo and Plan Repair verification.
 */
export function buildSimulatedSpikeEnvironment(baseEnv: EnvironmentBundle): EnvironmentBundle {
  const spikedHourly = baseEnv.hourly.map((point) => {
    // Simulate a late-afternoon & evening plume & dispersion collapse (14:00 - 22:00)
    if (point.hour >= 14 && point.hour <= 22) {
      const basePm25 = point.pm25 ?? 95;
      const spikedPm25 = Math.max(235, Math.round(basePm25 + 125));
      const spikedPm10 = Math.round(spikedPm25 * 1.2);
      return {
        ...point,
        pm25: spikedPm25,
        pm10: spikedPm10,
        usAqi: null,
        europeanAqi: null,
        boundaryLayerHeightM: Math.min(point.boundaryLayerHeightM ?? 60, 40),
        windSpeedKmh: Math.min(point.windSpeedKmh ?? 4, 2.2),
      };
    }
    return point;
  });

  const currentHour = baseEnv.current.hour;
  const updatedCurrent = spikedHourly.find((h) => h.hour === currentHour) ?? baseEnv.current;

  return {
    ...baseEnv,
    dataKind: 'simulated_scenario',
    simulationLabel: 'Simulated Afternoon–Evening Plume & Inversion Spike (14:00–22:00 PM2.5 >= 235 µg/m³)',
    fetchedAt: new Date().toISOString(),
    current: updatedCurrent,
    hourly: spikedHourly,
  };
}
