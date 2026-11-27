import { formatHourLabel } from '../shared/aqi.js';
import type { ConflictSolverResult, EnvironmentBundle, HouseholdProfile, MemberPassport } from '../shared/types.js';

/** Schedule-compatible candidates, not a routing or vehicle-capacity solver.
 * Unconfirmed trips never override a member's safety plan or count as realized savings.
 */
export function solveHouseholdConflicts(household: HouseholdProfile, passports: MemberPassport[], env: EnvironmentBundle): ConflictSolverResult {
  const items = passports.flatMap(p => p.timeline);
  const eligible = household.members.filter(m => !passports.find(p => p.memberId === m.id)?.urgentCareTriggered);
  const cars = eligible.flatMap(member => member.activities
    .filter(a => a.flexibility === 'fixed' && a.transportMode === 'car')
    .map(activity => ({ member, activity })));
  const combinedTrips: ConflictSolverResult['combinedTrips'] = [];
  for (const member of eligible) {
    for (const activity of member.activities) {
      if (activity.category !== 'grocery' && activity.transportMode !== 'two_wheeler') continue;
      const planned = items.find(t => t.memberId === member.id && t.activityId === activity.id);
      if (!planned || planned.suggestedAction.startsWith('No feasible')) continue;
      const car = cars.find(c => c.member.id !== member.id &&
        (activity.flexibility === 'fixed'
          ? c.activity.preferredStartHour === activity.preferredStartHour
          : Math.abs(c.activity.preferredStartHour - planned.recommendedHour) <= 1));
      if (!car) continue;
      const hour = activity.flexibility === 'fixed' ? activity.preferredStartHour : planned.recommendedHour;
      if (activity.transportMode === 'two_wheeler' && (env.hourly.find(h => h.hour === hour)?.pm25 ?? 0) < 35) continue;
      combinedTrips.push({
        id: `candidate-${member.id}-${activity.id}`,
        title: `Check shared trip: ${member.name} + ${car.member.name}`,
        involvedMemberNames: [member.name, car.member.name],
        originalTripsSummary: `${activity.title} at ${formatHourLabel(hour)}; ${car.activity.title} at ${formatHourLabel(car.activity.preferredStartHour)}.`,
        coordinatedPlanSummary: `Ask whether ${car.member.name}'s existing trip can cover this errand or share a ride without delaying either commitment. Keep the member's current precautions and schedule until confirmed.`,
        recommendedHour: hour,
        avoidedSoloKm: 0,
        tradeOff: 'Route overlap, seats, driver availability, detour distance and arrival deadlines are unknown. No distance or exposure saving is credited for this candidate.',
      });
    }
  }
  const total = (values: Array<number | null>) => values.length === 0 || values.some(v => v === null)
    ? null : Number(values.reduce<number>((sum, v) => sum + (v ?? 0), 0).toFixed(1));
  return {
    originalTimelineSummary: items.map(t => ({ memberId: t.memberId, memberName: t.memberName, activityTitle: t.title,
      hour: t.originalHour, mode: t.isOutdoorOriginal ? 'Outdoor' : 'Indoor / commute', exposureProxyUgHr: t.originalExposureProxyUgHr })),
    coordinatedTimelineSummary: items.map(t => ({ memberId: t.memberId, memberName: t.memberName, activityTitle: t.title,
      originalHour: t.originalHour, coordinatedHour: t.recommendedHour,
      mode: t.isOutdoorRecommended ? 'Outdoor with precautions' : t.indoorAlternativeUsed ? 'Indoor alternative' : 'Indoor / commute',
      changeReason: t.reason, exposureProxyUgHr: t.recommendedExposureProxyUgHr })),
    combinedTrips, totalAvoidedKm: 0,
    totalOriginalExposureProxyUgHr: total(items.map(t => t.originalExposureProxyUgHr)),
    totalCoordinatedExposureProxyUgHr: total(items.map(t => t.recommendedExposureProxyUgHr)),
    practicalBenefits: ['Fixed commitments retain their start times.', 'Flexible routines avoid occupied time slots; candidate shared trips are presented for household discussion.'],
    tradeOffs: ['This is schedule coordination, not route optimization. Shared-trip candidates do not modify plans or claim savings.',
      'Exposure comparisons reflect individual routine changes only and use illustrative indoor assumptions, not measured dose.'],
  };
}
