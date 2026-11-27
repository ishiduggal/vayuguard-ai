import { useState } from 'react';
import { CalendarDays, CheckSquare, Home, Leaf, ShieldAlert, Square, Wind } from 'lucide-react';
import type {
  EnvironmentBundle,
  GreenImpactResult,
  HouseholdProfile,
  IndoorAirPlan,
  SeasonalOutlookResult,
} from '../shared/types.js';

interface HomeScreenProps {
  household: HouseholdProfile;
  environment: EnvironmentBundle;
  indoorPlan: IndoorAirPlan;
  greenImpact: GreenImpactResult;
  seasonalOutlook: SeasonalOutlookResult;
  idlingMinutesSaved: number;
  onChangeIdlingMinutes: (minutes: number) => void;
  onToggleChecklistItem: (itemId: string) => void;
}

export function HomeScreen({
  household,
  indoorPlan,
  greenImpact,
  seasonalOutlook,
  idlingMinutesSaved,
  onChangeIdlingMinutes,
  onToggleChecklistItem,
}: HomeScreenProps) {
  const [indoorTierFilter, setIndoorTierFilter] = useState<'all' | 'free' | 'low_cost' | 'optional_purchase'>('all');

  const visibleIndoorRecs =
    indoorTierFilter === 'all'
      ? indoorPlan.recommendations
      : indoorPlan.recommendations.filter((r) => r.tier === indoorTierFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[#1C2321]">
          Home Air, Green Impact & Seasonal Outlook
        </h1>
        <p className="text-sm text-[#52605A]">
          Practical low-cost indoor improvements, honest emissions savings, and Punjab/India seasonal preparedness.
        </p>
      </div>

      {/* INDOOR AIR INTELLIGENCE */}
      <section className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
            <Home className="h-4 w-4" /> Indoor Air Intelligence
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              indoorPlan.safeToOpenWindowsNow
                ? 'bg-[#D8E6DF] text-[#1B4332]'
                : 'bg-[#FFEDD5] text-[#9A3412]'
            }`}
          >
            <Wind className="h-3.5 w-3.5" />
            {indoorPlan.safeToOpenWindowsNow ? 'Short airing OK now' : 'Keep road windows closed now'}
          </span>
        </div>

        <p className="mt-2.5 text-sm text-[#1C2321]">{indoorPlan.ventilationWindowAdvice}</p>
        <p className="mt-1.5 text-xs text-[#52605A]">{indoorPlan.indoorMeasurementNote}</p>

        {indoorPlan.combustionSafetyWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[#B45309]/30 bg-[#FEF3C7] p-3 text-xs text-[#92400E]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{indoorPlan.combustionSafetyWarning}</p>
          </div>
        )}

        {/* Prioritized Action Filter */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', 'All Tiers'],
              ['free', 'Free Actions'],
              ['low_cost', 'Low-Cost Actions'],
              ['optional_purchase', 'Optional Purchases'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setIndoorTierFilter(id)}
              className={`min-h-9 rounded-xl border px-3 text-xs font-semibold ${
                indoorTierFilter === id
                  ? 'border-[#1B4332] bg-[#1B4332] text-white'
                  : 'border-[#1C2321]/15 bg-[#FBF9F5] text-[#52605A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleIndoorRecs.map((rec) => (
            <div key={rec.id} className="rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#1C2321]">{rec.title}</h3>
                <span className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#1B4332]">
                  {rec.tier.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#1C2321]">{rec.action}</p>
              <p className="mt-1 text-[11px] text-[#52605A]">{rec.reason}</p>
              {rec.safetyNote && (
                <p className="mt-1 text-[11px] font-semibold text-[#92400E]">{rec.safetyNote}</p>
              )}
            </div>
          ))}
        </div>

        {/* Daily Indoor Checklist */}
        <div className="mt-5 rounded-2xl bg-[#F3EFE6]/70 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
            Daily Indoor Action Checklist
          </h3>
          <div className="mt-2.5 space-y-2">
            {indoorPlan.dailyChecklist.map((item) => {
              const checked = household.completedIndoorChecklistIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleChecklistItem(item.id)}
                  aria-pressed={checked}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2 text-left text-xs transition hover:bg-[#FBF9F5]"
                >
                  <span className="flex items-center gap-2.5">
                    {checked ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-[#1B4332]" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-[#52605A]" />
                    )}
                    <span className={checked ? 'line-through text-[#52605A]' : 'font-medium text-[#1C2321]'}>
                      {item.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[#52605A]">{item.timingHint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* GREEN IMPACT INTELLIGENCE */}
      <section className="rounded-3xl border border-[#1B4332]/20 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
          <Leaf className="h-4 w-4" /> Green Impact Intelligence
        </div>
        <h2 className="mt-1 text-lg font-semibold text-[#1C2321]">
          Household Emissions & Local Exhaust Reduction
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#D8E6DF]/45 p-3.5">
            <p className="text-xs font-medium text-[#1B4332]">Scenario CO₂ Reduction</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#1B4332]">
              {greenImpact.weeklyCo2SavedKg} kg CO₂/wk
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="text-xs font-medium text-[#52605A]">Scenario Exhaust PM2.5 Reduction</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#1C2321]">
              {greenImpact.weeklyLocalPmExhaustSavedG} g/wk
            </p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5">
            <p className="text-xs font-medium text-[#52605A]">Scenario Tailpipe NOx Reduction</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#1C2321]">
              {greenImpact.weeklyLocalNoxSavedG} g/wk
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-[#FBF9F5] p-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <label htmlFor="idling-slider">
              Engine-off idling avoided at school gates & signals (minutes/week):
            </label>
            <span className="font-bold text-[#1B4332]">{idlingMinutesSaved} min/wk</span>
          </div>
          <input
            id="idling-slider"
            type="range"
            min={0}
            max={90}
            step={5}
            value={idlingMinutesSaved}
            onChange={(e) => onChangeIdlingMinutes(Number(e.target.value))}
            className="mt-2 w-full accent-[#1B4332]"
          />
        </div>

        <div
          className={`mt-3 rounded-2xl border p-3.5 text-xs ${
            greenImpact.activeTravelBlockedBySmog
              ? 'border-[#C2410C]/30 bg-[#FFEDD5]/50 text-[#9A3412]'
              : 'border-[#2D6A4F]/25 bg-[#D8E6DF]/40 text-[#1B4332]'
          }`}
        >
          {greenImpact.safetyTradeOffNote}
        </div>

        <div className="mt-3 space-y-2">
          {greenImpact.actions.map((act) => (
            <div
              key={act.id}
              className="flex flex-col justify-between gap-1 rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] px-4 py-3 text-xs sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-[#1C2321]">{act.title}</p>
                <p className="text-[#52605A]">{act.localExhaustNote}</p>
              </div>
              <span className="shrink-0 font-bold text-[#1B4332]">
                -{act.co2SavedKgPerWeek} kg CO₂/wk
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-[#52605A]">{greenImpact.methodologyNote}</p>
      </section>

      {/* SEASONAL & WEATHER INTELLIGENCE */}
      <section className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#52605A]">
          <CalendarDays className="h-4 w-4" /> Seasonal & Weather Intelligence ({seasonalOutlook.cityName})
        </div>

        {/* Explicitly separated 3 information layers */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5 text-xs">
            <p className="font-bold text-[#1B4332]">1. Current Observation</p>
            <p className="mt-1 text-[#52605A]">{seasonalOutlook.currentObservationSummary}</p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5 text-xs">
            <p className="font-bold text-[#1B4332]">2. Short-Term Forecast</p>
            <p className="mt-1 text-[#52605A]">{seasonalOutlook.shortTermForecastSummary}</p>
          </div>
          <div className="rounded-2xl bg-[#FBF9F5] p-3.5 text-xs">
            <p className="font-bold text-[#1B4332]">3. Historical Pattern</p>
            <p className="mt-1 text-[#52605A]">{seasonalOutlook.historicalPatternSummary}</p>
          </div>
        </div>

        <p className="mt-3 rounded-2xl bg-[#F3EFE6] p-3 text-xs text-[#52605A]">
          {seasonalOutlook.cropBurningContextNote}
        </p>

        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#52605A]">
          12-Month Preparedness Calendar (Historical Tendencies, Not Long-Range Fog Predictions)
        </h3>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {seasonalOutlook.calendar.map((m) => {
            const levelBadge =
              m.typicalLevel === 'severe'
                ? 'bg-[#FEE2E2] text-[#991B1B]'
                : m.typicalLevel === 'elevated'
                  ? 'bg-[#FFEDD5] text-[#9A3412]'
                  : m.typicalLevel === 'moderate'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-[#D8E6DF] text-[#1B4332]';

            return (
              <div
                key={m.monthIndex}
                className="rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#1C2321]">{m.monthName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${levelBadge}`}>
                    {m.typicalLevel}
                  </span>
                </div>
                <p className="mt-1 font-medium text-[#1B4332]">{m.seasonTag}</p>
                {m.medianPm25UgM3 !== null && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-[#52605A]">
                    Historical median PM2.5: {m.medianPm25UgM3} µg/m³ (p90: {m.p90Pm25UgM3} µg/m³)
                  </p>
                )}
                <p className="mt-1 text-[11px] text-[#52605A]">{m.keyDrivers}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-[#52605A]">{seasonalOutlook.sourceNote}</p>
      </section>
    </div>
  );
}
