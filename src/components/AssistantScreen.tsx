import { checkSymptomSafetyGuidance } from '../engine/safetyRules.js';
import { useState } from 'react';
import { Globe2, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type {
  AssistantStructuredReply,
  ConflictSolverResult,
  EnvironmentBundle,
  HouseholdProfile,
  Language,
  MemberPassport,
  PlanRepairReport,
} from '../shared/types.js';

interface AssistantScreenProps {
  household: HouseholdProfile;
  environment: EnvironmentBundle;
  passports: MemberPassport[];
  conflictResult: ConflictSolverResult;
  planRepair: PlanRepairReport | null;
}

const SAMPLE_QUESTIONS = [
  'My son has asthma. What should his school routine look like today?',
  'My father wants to go for a walk. When would pollution exposure likely be lower?',
  'We cannot afford an air purifier. What can we do?',
  'Why did my daughter’s routine change?',
  'How can our family reduce unnecessary car journeys?',
];

const LANGUAGE_OPTIONS: Array<{ id: Language; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ' },
  { id: 'pa_roman', label: 'Roman Punjabi' },
];

export function AssistantScreen({
  household,
  environment,
}: AssistantScreenProps) {
  const [language, setLanguage] = useState<Language>('en');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [reply, setReply] = useState<AssistantStructuredReply | null>(null);

  async function askAssistant(qText: string) {
    const trimmed = qText.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        signal: AbortSignal.timeout(25000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          language,
          household: { ...household, householdName: 'Household', members: household.members.map((m, i) => ({
            ...m, name: `Member ${i + 1}`, role: m.ageGroup,
            sensitivities: { ...m.sensitivities, clinicianPrecautionsNote: '', urgentSymptomsReported: m.sensitivities.urgentSymptomsReported || checkSymptomSafetyGuidance(m.sensitivities.clinicianPrecautionsNote).urgentCareRequired },
            activities: m.activities.map(a => ({ ...a, title: a.category, notes: undefined }))
          })) },
          environment,
          passports: [],
          conflictResult: {},
          planRepair: null,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as AssistantStructuredReply;
      setReply(data);
    } catch (err) {
      setErrorMsg(
        `Assistant request failed (${err instanceof Error ? err.message : 'network error'}). Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[#1C2321]">
            Multilingual Decision Assistant
          </h1>
          <p className="text-sm text-[#52605A]">
            Explains the displayed forecast and family plans. AI explanations can be wrong; use the deterministic routine and safety guidance as the source of truth.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Globe2 className="h-4 w-4 shrink-0 text-[#1B4332]" />
          <select
            aria-label="Assistant language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="min-h-11 whitespace-nowrap rounded-2xl border border-[#1C2321]/15 bg-white px-3 text-sm font-semibold text-[#1B4332]"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#52605A]">
          Tap a common household question
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuestion(q);
                void askAssistant(q);
              }}
              className="min-h-10 rounded-2xl border border-[#1B4332]/20 bg-[#FBF9F5] px-3.5 py-2 text-left text-xs font-medium text-[#1B4332] transition hover:bg-[#D8E6DF]/50"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void askAssistant(question);
          }}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            maxLength={600}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask in English, Hindi, Punjabi, or Roman Punjabi…"
            aria-label="Ask VayuGuard Assistant"
            className="min-h-12 flex-1 rounded-2xl border border-[#1C2321]/15 bg-[#FBF9F5] px-4 text-sm focus:border-[#1B4332] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#1B4332] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        <p className="mt-2.5 text-[11px] text-[#52605A]">
          Names, roles, activity notes and clinician notes are removed from the attached profile before sending it to the server. Your typed question, city, age groups and generalized plan context may be sent to Google Gemini. Do not include private medical details in your question. Member numbers follow Family order.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-[#991B1B]/30 bg-[#FEE2E2] p-4 text-sm text-[#991B1B]">
          {errorMsg}
        </div>
      )}

      {reply && (
        <article className="space-y-4 rounded-3xl border border-[#1B4332]/20 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D8E6DF] px-3 py-1 text-xs font-semibold text-[#1B4332]">
              <Sparkles className="h-3.5 w-3.5" />
              {reply.usedGemini
                ? `Gemini (${reply.modelName})`
                : 'Deterministic Multilingual Engine'}
            </span>
            <span className="text-xs text-[#52605A]">
              Language: {LANGUAGE_OPTIONS.find((l) => l.id === reply.language)?.label}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-[#1C2321]">{reply.summary}</h2>

          <div className="rounded-2xl bg-[#FBF9F5] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1B4332]">
              Practical Action Steps
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-[#1C2321]">
              {reply.actionSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-[#1B4332]/15 bg-[#F3EFE6] p-3.5 text-xs text-[#1C2321]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1B4332]" />
            <div>
              <p className="font-semibold">{reply.precautionNote}</p>
              <p className="mt-1 text-[#52605A]">{reply.groundingNote}</p>
              {reply.fallbackReason && (
                <p className="mt-1 text-[11px] text-[#52605A]">{reply.fallbackReason}</p>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
