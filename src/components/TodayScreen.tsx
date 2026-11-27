import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  ShieldAlert,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react';
import {
  classifyUsAqi,
  computeIllustrativeCpcbPm25SubIndex,
  formatHourLabel,
  windCompassDirection,
} from '../shared/aqi.js';
import type {
  ConflictSolverResult,
  EnvironmentBundle,
  HouseholdProfile,
  MemberPassport,
  PlanRepairReport,
} from '../shared/types.js';
import { DataProvenanceStrip, PrecautionBadge } from './StatusBadge.js';

export type NavTab = 'today' | 'family' | 'routine' | 'home' | 'assistant';

interface TodayScreenProps {
  household: HouseholdProfile;
  environment: EnvironmentBundle;
  passports: MemberPassport[];
  conflictResult: ConflictSolverResult;
  planRepair: PlanRepairReport | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNavigate: (tab: NavTab) => void;
  onSelectMemberAndNavigate: (memberId: string, tab: NavTab) => void;
  onTriggerSimulatedSpike: () => void;
  onClearSimulation: () => void;
  onLoadPatialaDemo: () => void;
  onEditOnboarding: () => void;
  onStartTour: () => void;
}

export function TodayScreen({
  household,
  environment,
  passports,
  conflictResult,
  planRepair,
  isRefreshing,
  onRefresh,
  onNavigate,
  onSelectMemberAndNavigate,
  onTriggerSimulatedSpike,
  onClearSimulation,
  onLoadPatialaDemo,
  onEditOnboarding,
  onStartTour,
}: TodayScreenProps) {
  const [showCpcbCaveat, setShowCpcbCaveat] = useState(false);

  const usAqiInfo = classifyUsAqi(environment.current.usAqi);
  const illustrativeCpcb = computeIllustrativeCpcbPm25SubIndex(environment.current.pm25);

  const urgentMembers = passports.filter((p) => p.urgentCareTriggered);
  const highCareMembers = passports.filter(
    (p) => p.precautionTier === 'high' || p.precautionTier === 'stay_indoors',
  );

  // Determine single highest-priority next household action
  const shiftedOutdoor = passports
    .flatMap((p) => p.timeline)
    .find((t) => t.indoorAlternativeUsed || t.recommendedHour !== t.originalHour);
  const topComboTrip = conflictResult.combinedTrips[0];

  const nextActionHeadline =
    urgentMembers.length > 0
      ? `Urgent Care Check for ${urgentMembers.map((m) => m.memberName).join(', ')}`
      : topComboTrip
        ? topComboTrip.title
        : shiftedOutdoor
          ? `${shiftedOutdoor.memberName}: ${shiftedOutdoor.suggestedAction}`
          : 'Keep flexible outdoor tasks during the midday dispersion window.';

  const nextActionDetail =
    urgentMembers.length > 0
      ? urgentMembers[0].urgentCareMessage ?? ''
      : topComboTrip
        ? topComboTrip.coordinatedPlanSummary
        : shiftedOutdoor
          ? shiftedOutdoor.reason
          : 'Morning and night inversions hold particulates near ground level.';


  return (
    <div className="space-y-5">
      {/* Urgent Care Banner if triggered */}
      {urgentMembers.length > 0 && (
        <div
          role="alert"
          className="rounded-3xl border border-[#991B1B]/30 bg-[#FEE2E2] p-5 text-[#991B1B]"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-base font-bold">
                Urgent Medical Guidance ({urgentMembers.map((m) => m.memberName).join(', ')})
              </h2>
              <p className="mt-1 text-sm">{urgentMembers[0].urgentCareMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Repair Active Alert Strip */}
      {planRepair?.hasChanges && (
        <div className="flex flex-col gap-2 rounded-3xl border border-[#C2410C]/30 bg-[#FFEDD5] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-[#9A3412]">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Plan Repair Active: {planRepair.summary}</p>
              <p className="text-xs">
                Affected: {planRepair.affectedMemberNames.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {environment.dataKind === 'simulated_scenario' && (
              <button
                type="button"
                onClick={onClearSimulation}
                className="min-h-10 rounded-xl border border-[#9A3412]/30 bg-white px-3 text-xs font-semibold text-[#9A3412]"
              >
                Reset Simulation
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="min-h-10 rounded-xl bg-[#9A3412] px-3.5 text-xs font-semibold text-white"
            >
              Inspect Changes
            </button>
          </div>
        </div>
      )}

      {/* Hero Decision Card: What today means */}
      <section className="rounded-3xl border border-[#1B4332]/15 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
              {household.location.name}, {household.location.state} · {household.householdName}
            </p>
            <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-[#1C2321] sm:text-3xl">
              {environment.dataKind === 'fallback_offline' ? 'Illustrative demo — live conditions unavailable.' : usAqiInfo.tier === 'stay_indoors'
                ? 'Keep sensitive routines indoors today.'
                : usAqiInfo.tier === 'high'
                  ? 'Shift outdoor activity away from hazy hours.'
                  : usAqiInfo.tier === 'moderate'
                    ? 'Take light precautions for sensitive members.'
                    : 'Lower AQI today; check individual precautions.'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#52605A]">
              {usAqiInfo.description}
            </p>
          </div>
          <PrecautionBadge tier={usAqiInfo.tier} label={usAqiInfo.label} />
        </div>

        {/* Concise Telemetry Strip (Plain units, no clutter) */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl bg-[#FBF9F5] p-3">
            <p className="text-[11px] font-medium text-[#52605A]">Modeled PM2.5</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1C2321]">
              {environment.current.pm25 !== null ? `${Math.round(environment.current.pm25)} µg/m³` : 'Unavailable'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3">
            <p className="text-[11px] font-medium text-[#52605A]">US AQI (Open-Meteo)</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-[#1C2321]">
              {environment.current.usAqi !== null ? Math.round(environment.current.usAqi) : 'Unavailable'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3">
            <p className="text-[11px] font-medium text-[#52605A]">Temp · Wind</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1C2321]">
              {environment.current.temperatureC !== null ? `${Math.round(environment.current.temperatureC)}°C` : 'N/A'} ·{' '}
              {environment.current.windSpeedKmh !== null
                ? `${Math.round(environment.current.windSpeedKmh)} km/h ${windCompassDirection(environment.current.windDirectionDeg)}`
                : 'N/A'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3">
            <p className="text-[11px] font-medium text-[#52605A]">Mixing Layer (BLH)</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#1C2321]">
              {environment.current.boundaryLayerHeightM !== null
                ? `${Math.round(environment.current.boundaryLayerHeightM)} m`
                : 'Unavailable'}
              {environment.current.boundaryLayerHeightM !== null &&
              environment.current.boundaryLayerHeightM < 120
                ? ' (Stagnant)'
                : ''}
            </p>
          </div>
        </div>

        {/* Optional illustrative CPCB sub-index disclosure */}
        {illustrativeCpcb && (
          <div className="mt-3 text-xs text-[#52605A]">
            <button
              type="button"
              onClick={() => setShowCpcbCaveat((v) => !v)}
              className="font-medium text-[#1B4332] underline underline-offset-2"
            >
              {showCpcbCaveat ? 'Hide' : 'Show'} illustrative Indian CPCB-breakpoint PM2.5 sub-index (~{illustrativeCpcb.subIndex} · {illustrativeCpcb.category})
            </button>
            {showCpcbCaveat && (
              <p className="mt-1 rounded-xl bg-[#F3EFE6] p-2.5 text-[11px]">
                {illustrativeCpcb.caveat}
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <DataProvenanceStrip
            environment={environment}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
          />
        </div>
      </section>

      {/* Next Important Action + Who Needs Extra Care */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#1B4332]/15 bg-[#1B4332] p-5 text-[#FBF9F5] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D8E6DF]">
            <Clock className="h-4 w-4" /> Household Planning Suggestion
          </div>
          <h2 className="mt-2 text-lg font-semibold">{nextActionHeadline}</h2>
          <p className="mt-1.5 text-sm text-[#D8E6DF]">{nextActionDetail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-[#FBF9F5] px-4 text-sm font-semibold text-[#1B4332]"
            >
              Open Routine & Conflict Solver <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onTriggerSimulatedSpike}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-[#D8E6DF]/40 px-4 text-sm font-semibold text-[#FBF9F5] hover:bg-white/10"
            >
              Simulate Forecast Change
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#52605A]">
              <Users className="h-4 w-4" /> Who Needs Extra Precautions Today
            </div>
            <button
              type="button"
              onClick={() => onNavigate('family')}
              className="text-xs font-semibold text-[#1B4332] underline"
            >
              Compare All ({passports.length})
            </button>
          </div>
          <p className="mt-1 text-sm text-[#52605A]">
            {highCareMembers.length > 0
              ? `${highCareMembers.map((m) => m.memberName).join(', ')} require elevated protection based on reported sensitivity, age, and schedule.`
              : 'All household members are in low-to-moderate precaution tiers today.'}
          </p>
          <div className="mt-3 space-y-2">
            {passports.map((p) => {
              const firstTimeline = p.timeline[0];
              return (
                <button
                  key={p.memberId}
                  type="button"
                  onClick={() => onSelectMemberAndNavigate(p.memberId, 'family')}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] px-3.5 py-2.5 text-left transition hover:bg-[#F3EFE6]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1C2321]">
                      {p.memberName}{' '}
                      <span className="font-normal text-[#52605A]">· {p.role}</span>
                    </p>
                    <p className="truncate text-xs text-[#52605A]">
                      {firstTimeline
                        ? `${formatHourLabel(firstTimeline.recommendedHour)}: ${firstTimeline.suggestedAction}`
                        : p.todayOutlook}
                    </p>
                  </div>
                  <PrecautionBadge tier={p.precautionTier} />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* 60-Second Judge Walkthrough / Demo Controls */}
      <section className="rounded-3xl border border-[#1B4332]/15 bg-[#F3EFE6] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
              <Sparkles className="h-4 w-4" />
              {household.isDemo ? 'Patiala Family Demo Active (60s Judge Tour)' : 'Quick Demo & Household Setup'}
            </div>
            <p className="mt-1 text-sm text-[#52605A]">
              Explore the guided reviewer walkthrough using a fictional five-member household.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!household.isDemo && (
              <button
                type="button"
                onClick={onLoadPatialaDemo}
                className="min-h-11 rounded-2xl border border-[#1B4332]/25 bg-white px-4 text-xs font-semibold text-[#1B4332]"
              >
                Load Patiala Family Demo
              </button>
            )}
            <button
              type="button"
              onClick={onEditOnboarding}
              className="min-h-11 rounded-2xl border border-[#1C2321]/15 bg-white px-4 text-xs font-semibold text-[#1C2321]"
            >
              Edit Setup / Location
            </button>
            <button type="button" onClick={onStartTour} className="min-h-11 rounded-2xl bg-[#1B4332] px-4 text-xs font-semibold text-white">
              <Wind className="mr-1 inline h-4 w-4" /> Start 60s Judge Tour
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
