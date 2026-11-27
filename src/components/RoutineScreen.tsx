import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  GitCompare,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatHourLabel } from '../shared/aqi.js';
import type {
  ConflictSolverResult,
  EnvironmentBundle,
  Flexibility,
  HouseholdProfile,
  MemberPassport,
  PlanRepairReport,
} from '../shared/types.js';
import { PrecautionBadge } from './StatusBadge.js';

interface RoutineScreenProps {
  household: HouseholdProfile;
  environment: EnvironmentBundle;
  passports: MemberPassport[];
  conflictResult: ConflictSolverResult;
  planRepair: PlanRepairReport | null;
  selectedMemberId: string;
  onSelectMember: (id: string) => void;
  onUpdateHousehold: (next: HouseholdProfile) => void;
  onTriggerSimulatedSpike: () => void;
  onClearSimulation: () => void;
  onRefreshLive: () => void;
  isRefreshing: boolean;
}

export function RoutineScreen({
  household,
  environment,
  passports,
  conflictResult,
  planRepair,
  selectedMemberId,
  onSelectMember,
  onUpdateHousehold,
  onTriggerSimulatedSpike,
  onClearSimulation,
  onRefreshLive,
  isRefreshing,
}: RoutineScreenProps) {
  const [conflictView, setConflictView] = useState<'coordinated' | 'original'>('coordinated');
  const activePassport =
    passports.find((p) => p.memberId === selectedMemberId) ?? passports[0];

  function updateActivitySchedule(
    memberId: string,
    activityId: string,
    patch: { preferredStartHour?: number; flexibility?: Flexibility },
  ) {
    onUpdateHousehold({
      ...household,
      members: household.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              activities: m.activities.map((a) =>
                a.id === activityId ? { ...a, ...patch } : a,
              ),
            }
          : m,
      ),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[#1C2321]">
            Daily Routine & Household Conflict Solver
          </h1>
          <p className="text-sm text-[#52605A]">
            Deterministic hourly optimization respecting fixed school/office commitments and household trip coordination.
          </p>
        </div>
      </div>

      {/* PLAN REPAIR PANEL */}
      <section className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9A3412]">
              <Zap className="h-4 w-4" /> Proactive Plan Repair
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#1C2321]">
              {planRepair?.hasChanges
                ? planRepair.summary
                : 'Test or refresh forecast updates to inspect automatic Plan Repair'}
            </h2>
            <p className="mt-0.5 text-xs text-[#52605A]">
              {planRepair?.notificationLimitation ??
                'In-app alerts recalculate immediately whenever forecasts change; background OS push notifications are not enabled.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {environment.dataKind === 'simulated_scenario' ? (
              <button
                type="button"
                onClick={onClearSimulation}
                className="min-h-11 rounded-2xl border border-[#9A3412]/30 bg-[#FFEDD5] px-4 text-xs font-semibold text-[#9A3412]"
              >
                Exit Simulated Spike
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerSimulatedSpike}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-[#9A3412] px-4 text-xs font-semibold text-white"
              >
                <AlertTriangle className="h-4 w-4" /> Simulate Forecast Change (Evening Spike)
              </button>
            )}
            <button
              type="button"
              onClick={onRefreshLive}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-[#1B4332]/20 bg-[#FBF9F5] px-4 text-xs font-semibold text-[#1B4332]"
            >
              <RefreshCw className="h-4 w-4" /> {isRefreshing ? 'Refreshing…' : 'Refresh Live'}
            </button>
          </div>
        </div>

        {planRepair?.hasChanges && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {planRepair.changes.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[#C2410C]/25 bg-[#FFEDD5]/40 p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1C2321]">
                    {c.memberName} · {c.activityTitle}
                  </span>
                  <span className="rounded-full bg-[#9A3412] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {c.severity}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#9A3412]">{c.whatChanged}</p>
                <div className="mt-2 space-y-1 rounded-xl bg-white/80 p-2.5 text-xs">
                  <p>
                    <strong>Before:</strong> {c.previousAction}
                  </p>
                  <p className="text-[#1B4332]">
                    <strong>Updated:</strong> {c.updatedAction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SIGNATURE INNOVATION: FAMILY CONFLICT SOLVER */}
      <section className="rounded-3xl border border-[#1B4332]/20 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
              <GitCompare className="h-4 w-4" /> Signature Innovation · Family Conflict Solver
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#1C2321]">
              Coordinated Household Schedule vs Original Plan
            </h2>
          </div>

          <div className="inline-flex rounded-2xl border border-[#1C2321]/10 bg-[#F3EFE6] p-1">
            <button
              type="button"
              onClick={() => setConflictView('original')}
              className={`min-h-10 rounded-xl px-3.5 text-xs font-semibold ${
                conflictView === 'original' ? 'bg-white text-[#1C2321] shadow-sm' : 'text-[#52605A]'
              }`}
            >
              Original Schedule
            </button>
            <button
              type="button"
              onClick={() => setConflictView('coordinated')}
              className={`min-h-10 rounded-xl px-3.5 text-xs font-semibold ${
                conflictView === 'coordinated'
                  ? 'bg-[#1B4332] text-white shadow-sm'
                  : 'text-[#52605A]'
              }`}
            >
              Coordinated Schedule
            </button>
          </div>
        </div>

        {/* Household Gains Summary */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#D8E6DF]/45 p-3.5">
            <p className="text-xs font-medium text-[#1B4332]">Confirmed Distance Avoided</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#1B4332]">
              {conflictResult.totalAvoidedKm} km/day
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="text-xs font-medium text-[#52605A]">Shared-Trip Candidates</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#1C2321]">
              {conflictResult.combinedTrips.length}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="text-xs font-medium text-[#52605A]">Household Exposure Proxy</p>
            <p className="mt-1 text-base font-bold tabular-nums text-[#1C2321]">
              {conflictResult.totalOriginalExposureProxyUgHr ?? 'N/A'} {'->'}{' '}
              {conflictResult.totalCoordinatedExposureProxyUgHr ?? 'N/A'} µg/m³·hr
            </p>
          </div>
        </div>

        {conflictResult.combinedTrips.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {conflictResult.combinedTrips.map((trip) => (
              <div
                key={trip.id}
                className="rounded-2xl border border-[#2D6A4F]/25 bg-[#FBF9F5] p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#1B4332]">{trip.title}</span>
                  <span className="rounded-full bg-[#D8E6DF] px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                    Unconfirmed · {formatHourLabel(trip.recommendedHour)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#52605A]">
                  <strong>Original:</strong> {trip.originalTripsSummary}
                </p>
                <p className="mt-1 text-xs text-[#1C2321]">
                  <strong>Coordinated:</strong> {trip.coordinatedPlanSummary}
                </p>
                <p className="mt-1 text-[11px] text-[#52605A]">
                  <strong>Trade-off:</strong> {trip.tradeOff}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#1C2321]/10">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-[#F3EFE6] text-[#52605A]">
              <tr>
                <th className="px-3.5 py-2.5">Member</th>
                <th className="px-3.5 py-2.5">Activity</th>
                <th className="px-3.5 py-2.5">Time</th>
                <th className="px-3.5 py-2.5">Mode</th>
                <th className="px-3.5 py-2.5">Exposure Proxy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C2321]/10">
              {conflictView === 'original'
                ? conflictResult.originalTimelineSummary.map((row, idx) => (
                    <tr key={`${row.memberId}-${idx}`}>
                      <td className="px-3.5 py-2.5 font-semibold">{row.memberName}</td>
                      <td className="px-3.5 py-2.5">{row.activityTitle}</td>
                      <td className="px-3.5 py-2.5">{formatHourLabel(row.hour)}</td>
                      <td className="px-3.5 py-2.5">{row.mode}</td>
                      <td className="px-3.5 py-2.5 tabular-nums">
                        {row.exposureProxyUgHr !== null ? `${row.exposureProxyUgHr} µg/m³·hr` : 'N/A'}
                      </td>
                    </tr>
                  ))
                : conflictResult.coordinatedTimelineSummary.map((row, idx) => (
                    <tr key={`${row.memberId}-${idx}`}>
                      <td className="px-3.5 py-2.5 font-semibold">{row.memberName}</td>
                      <td className="px-3.5 py-2.5">
                        {row.activityTitle}
                        <div className="text-[11px] text-[#52605A]">{row.changeReason}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-[#1B4332]">
                        {row.originalHour !== row.coordinatedHour
                          ? `${formatHourLabel(row.originalHour)} -> ${formatHourLabel(row.coordinatedHour)}`
                          : formatHourLabel(row.coordinatedHour)}
                      </td>
                      <td className="px-3.5 py-2.5">{row.mode}</td>
                      <td className="px-3.5 py-2.5 tabular-nums text-[#1B4332]">
                        {row.exposureProxyUgHr !== null ? `${row.exposureProxyUgHr} µg/m³·hr` : 'N/A'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="font-semibold text-[#1B4332]">Practical Benefits</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[#52605A]">
              {conflictResult.practicalBenefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="font-semibold text-[#1C2321]">Honest Trade-Offs</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[#52605A]">
              {conflictResult.tradeOffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* INDIVIDUAL MEMBER CHRONOLOGICAL TIMELINE */}
      {activePassport && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#1B4332]" />
              <h2 className="text-lg font-semibold text-[#1C2321]">
                Personalized Daily Timeline (Edit & Recalculate)
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {passports.map((p) => (
                <button
                  key={p.memberId}
                  type="button"
                  onClick={() => onSelectMember(p.memberId)}
                  className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${
                    p.memberId === activePassport.memberId
                      ? 'border-[#1B4332] bg-[#1B4332] text-white'
                      : 'border-[#1C2321]/15 bg-white text-[#1C2321]'
                  }`}
                >
                  {p.memberName}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {activePassport.timeline.map((item) => (
              <article
                key={item.activityId}
                className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-xl bg-[#F3EFE6] px-2.5 py-1 text-xs font-bold text-[#1B4332]">
                        {formatHourLabel(item.recommendedHour)}
                        {item.recommendedHour !== item.originalHour && (
                          <span className="ml-1 font-normal text-[#52605A]">
                            (from {formatHourLabel(item.originalHour)})
                          </span>
                        )}
                      </span>
                      <span className="rounded-xl border border-[#1C2321]/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-[#52605A]">
                        {item.flexibility}
                      </span>
                      <span className="text-xs text-[#52605A]">{item.durationMinutes} min</span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-[#1C2321]">{item.title}</h3>
                  </div>
                  <PrecautionBadge tier={item.precautionTier} />
                </div>

                <p className="mt-2 text-xs font-medium text-[#52605A]">{item.conditionsSummary}</p>

                <div className="mt-3 rounded-2xl bg-[#FBF9F5] p-3.5 text-sm">
                  <p className="font-semibold text-[#1B4332]">
                    <ArrowRight className="mr-1 inline h-4 w-4" />
                    {item.suggestedAction}
                  </p>
                  <p className="mt-1 text-xs text-[#52605A]">
                    <strong>Why:</strong> {item.reason}
                  </p>
                  <p className="mt-1 text-xs text-[#1C2321]">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#1B4332]" />
                    <strong>Precaution:</strong> {item.precaution}
                  </p>
                </div>

                {/* Inline schedule adjuster for instant recalculation */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#52605A]">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="font-medium">Adjust start:</label>
                    <select
                      aria-label={`Change start time for ${item.title}`}
                      value={item.originalHour}
                      onChange={(e) =>
                        updateActivitySchedule(item.memberId, item.activityId, {
                          preferredStartHour: Number(e.target.value),
                        })
                      }
                      className="min-h-9 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-2.5 text-xs"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Change flexibility for ${item.title}`}
                      value={item.flexibility}
                      onChange={(e) =>
                        updateActivitySchedule(item.memberId, item.activityId, {
                          flexibility: e.target.value as Flexibility,
                        })
                      }
                      className="min-h-9 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-2.5 text-xs"
                    >
                      <option value="flexible">Flexible</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>

                  <div className="text-right text-[11px]">
                    <span>Confidence: {item.confidenceLabel}</span>
                    {item.recommendedExposureProxyUgHr !== null && (
                      <span className="ml-2 font-medium text-[#1B4332]">
                        · Proxy: {item.originalExposureProxyUgHr} {'->'}{' '}
                        {item.recommendedExposureProxyUgHr} µg/m³·hr
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
