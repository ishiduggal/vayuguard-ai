import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { EnvironmentBundle, PrecautionTier } from '../shared/types.js';

export function PrecautionBadge({ tier, label }: { tier: PrecautionTier; label?: string }) {
  const config: Record<
    PrecautionTier,
    { bg: string; text: string; border: string; defaultLabel: string; Icon: typeof CheckCircle2 }
  > = {
    low: {
      bg: 'bg-[#D8E6DF]',
      text: 'text-[#1B4332]',
      border: 'border-[#2D6A4F]/30',
      defaultLabel: 'Low Precaution',
      Icon: CheckCircle2,
    },
    moderate: {
      bg: 'bg-[#FEF3C7]',
      text: 'text-[#92400E]',
      border: 'border-[#B45309]/30',
      defaultLabel: 'Moderate Precaution',
      Icon: Info,
    },
    high: {
      bg: 'bg-[#FFEDD5]',
      text: 'text-[#9A3412]',
      border: 'border-[#C2410C]/30',
      defaultLabel: 'High Precaution',
      Icon: AlertTriangle,
    },
    stay_indoors: {
      bg: 'bg-[#FEE2E2]',
      text: 'text-[#991B1B]',
      border: 'border-[#991B1B]/30',
      defaultLabel: 'Stay Indoors',
      Icon: ShieldAlert,
    },
  };

  const c = config[tier];
  const Icon = c.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label ?? c.defaultLabel}</span>
    </span>
  );
}

export function DataProvenanceStrip({
  environment,
  onRefresh,
  isRefreshing,
}: {
  environment: EnvironmentBundle;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const kindLabel =
    environment.dataKind === 'simulated_scenario'
      ? 'Simulated Scenario (Demo)'
      : environment.dataKind === 'fallback_offline'
        ? 'Offline Illustrative Fallback'
        : 'Modeled Forecast (Open-Meteo CAMS)';

  const kindColor =
    environment.dataKind === 'simulated_scenario'
      ? 'bg-[#FFEDD5] text-[#9A3412] border-[#C2410C]/30'
      : environment.isStale || environment.dataKind === 'fallback_offline'
        ? 'bg-[#FEF3C7] text-[#92400E] border-[#B45309]/30'
        : 'bg-[#D8E6DF]/70 text-[#1B4332] border-[#2D6A4F]/25';

  const fetchedTime = new Date(environment.fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1C2321]/10 bg-[#F3EFE6]/80 px-3.5 py-2.5 text-xs text-[#52605A]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${kindColor}`}>
          {kindLabel}
        </span>
        <span>
          Standard: <strong className="text-[#1C2321]">{environment.aqiStandard}</strong>
        </span>
        <span>· Updated {fetchedTime}</span>
        <span>· Daily schedule: {environment.hourly[0]?.time.slice(0, 10)} ({environment.location.timezone})</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="min-h-8 rounded-xl border border-[#1B4332]/20 bg-white px-3 py-1 font-medium text-[#1B4332] transition hover:bg-[#D8E6DF]/40 disabled:opacity-50"
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh Live Data'}
      </button>
      {environment.staleReason && (
        <p className="w-full text-[11px] text-[#92400E]">{environment.staleReason}</p>
      )}
    </div>
  );
}
