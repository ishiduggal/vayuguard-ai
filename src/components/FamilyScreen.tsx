import { useState } from 'react';
import { Columns3, Plus, ShieldAlert, Trash2, User, Users } from 'lucide-react';
import type {
  AgeGroup,
  FamilyMember,
  HouseholdProfile,
  MemberPassport,
  SensitivityAnswer,
} from '../shared/types.js';
import { PrecautionBadge } from './StatusBadge.js';

interface FamilyScreenProps {
  household: HouseholdProfile;
  passports: MemberPassport[];
  selectedMemberId: string;
  onSelectMember: (id: string) => void;
  onUpdateHousehold: (next: HouseholdProfile) => void;
  onDeleteAllHouseholdData: () => void;
}

type FamilyViewMode = 'entire' | 'individual' | 'compare';

export function FamilyScreen({
  household,
  passports,
  selectedMemberId,
  onSelectMember,
  onUpdateHousehold,
  onDeleteAllHouseholdData,
}: FamilyScreenProps) {
  const [viewMode, setViewMode] = useState<FamilyViewMode>('individual');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAgeGroup, setNewAgeGroup] = useState<AgeGroup>('adult');
  const [newAsthma, setNewAsthma] = useState<SensitivityAnswer>('no');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const selectedPassport =
    passports.find((p) => p.memberId === selectedMemberId) ?? passports[0];

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const member: FamilyMember = {
      id: `member-${Date.now()}`,
      name: newName.trim(),
      role: newRole.trim() || 'Family Member',
      ageGroup: newAgeGroup,
      wakeHour: 6,
      sleepHour: 22,
      preferredLanguage: 'en',
      sensitivities: {
        diagnosedAsthma: newAsthma,
        dustOrSeasonalAllergy: 'no',
        smokeOrCropBurningSensitivity: 'no',
        otherRespiratoryCondition: 'no',
        coldAirSensitivity: 'no',
        frequentIrritationDuringSmog: 'no',
        clinicianPrecautionsNote: '',
        urgentSymptomsReported: false,
      },
      activities: [
        {
          id: `act-${Date.now()}`,
          title: 'Daily outdoor walk',
          category: 'morning_walk',
          flexibility: 'flexible',
          preferredStartHour: 7,
          durationMinutes: 30,
          intensity: 'moderate',
          isOutdoor: true,
        },
      ],
    };
    onUpdateHousehold({
      ...household,
      isDemo: false,
      members: [...household.members, member],
    });
    onSelectMember(member.id);
    setNewName('');
    setNewRole('');
    setShowAddForm(false);
  }

  function handleRemoveMember(id: string) {
    if (household.members.length <= 1) return;
    const remaining = household.members.filter((m) => m.id !== id);
    onUpdateHousehold({
      ...household,
      members: remaining,
    });
    if (selectedMemberId === id && remaining[0]) {
      onSelectMember(remaining[0].id);
    }
  }

  function toggleUrgentSymptoms(memberId: string) {
    onUpdateHousehold({
      ...household,
      members: household.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              sensitivities: {
                ...m.sensitivities,
                urgentSymptomsReported: !m.sensitivities.urgentSymptomsReported,
              },
            }
          : m,
      ),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[#1C2321]">
            Family Air Health Passport
          </h1>
          <p className="text-sm text-[#52605A]">
            Non-clinical precaution categories tailored to each household member’s age, sensitivities, and schedule.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-2xl border border-[#1C2321]/10 bg-[#F3EFE6] p-1">
          {(
            [
              ['entire', 'Entire Family', Users],
              ['individual', 'Individual', User],
              ['compare', 'Compare', Columns3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={viewMode === id}
              onClick={() => setViewMode(id)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                viewMode === id
                  ? 'bg-white text-[#1B4332] shadow-sm'
                  : 'text-[#52605A] hover:text-[#1C2321]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Member Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-[#1B4332]/25 bg-white px-4 text-xs font-semibold text-[#1B4332]"
        >
          <Plus className="h-4 w-4" /> Add Family Member
        </button>

        {!confirmDeleteAll ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteAll(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl border border-[#991B1B]/25 bg-white px-3.5 text-xs font-semibold text-[#991B1B]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Household Data
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-[#991B1B]/30 bg-[#FEE2E2] px-3 py-1.5 text-xs">
            <span className="font-semibold text-[#991B1B]">Clear all local data?</span>
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteAll(false);
                onDeleteAllHouseholdData();
              }}
              className="rounded-lg bg-[#991B1B] px-2.5 py-1 font-semibold text-white"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(false)}
              className="rounded-lg bg-white px-2.5 py-1 font-medium text-[#1C2321]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="grid grid-cols-1 gap-3 rounded-3xl border border-[#1B4332]/20 bg-white p-4 shadow-sm sm:grid-cols-5"
        >
          <input
            type="text"
            required
            placeholder="Name / Nickname"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-h-11 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
          />
          <input
            type="text"
            placeholder="Role (e.g., Aunt)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="min-h-11 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
          />
          <select
            aria-label="New member age group"
            value={newAgeGroup}
            onChange={(e) => setNewAgeGroup(e.target.value as AgeGroup)}
            className="min-h-11 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
          >
            <option value="infant_toddler">Infant / Toddler</option>
            <option value="child">School Child</option>
            <option value="teen_student">Student</option>
            <option value="adult">Adult</option>
            <option value="older_adult">Older Adult</option>
          </select>
          <select
            aria-label="New member asthma history"
            value={newAsthma}
            onChange={(e) => setNewAsthma(e.target.value as SensitivityAnswer)}
            className="min-h-11 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
          >
            <option value="no">Asthma: No</option>
            <option value="yes">Asthma: Yes</option>
            <option value="not_sure">Asthma: Not sure</option>
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-[#1B4332] px-4 text-sm font-semibold text-white"
          >
            Save Member
          </button>
        </form>
      )}

      {/* VIEW 1: INDIVIDUAL MEMBER */}
      {viewMode === 'individual' && selectedPassport && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {passports.map((p) => (
              <button
                key={p.memberId}
                type="button"
                onClick={() => onSelectMember(p.memberId)}
                className={`min-h-11 rounded-2xl border px-4 text-sm font-semibold transition ${
                  p.memberId === selectedPassport.memberId
                    ? 'border-[#1B4332] bg-[#1B4332] text-white'
                    : 'border-[#1C2321]/15 bg-white text-[#1C2321]'
                }`}
              >
                {p.memberName}
              </button>
            ))}
          </div>

          <article className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#1C2321]">
                  {selectedPassport.memberName}{' '}
                  <span className="text-sm font-normal text-[#52605A]">
                    · {selectedPassport.role}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-[#52605A]">{selectedPassport.todayOutlook}</p>
              </div>
              <div className="flex items-center gap-2">
                <PrecautionBadge
                  tier={selectedPassport.precautionTier}
                  label={selectedPassport.precautionLabel}
                />
                {household.members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(selectedPassport.memberId)}
                    aria-label={`Remove ${selectedPassport.memberName}`}
                    className="rounded-xl border border-[#991B1B]/20 p-2 text-[#991B1B] hover:bg-[#FEE2E2]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {selectedPassport.urgentCareTriggered && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#991B1B]/30 bg-[#FEE2E2] p-4 text-sm text-[#991B1B]">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{selectedPassport.urgentCareMessage}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#FBF9F5] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#52605A]">
                  Sensitivity Factors
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#1C2321]">
                  {selectedPassport.sensitivityFactors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-[#FBF9F5] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#52605A]">
                  Suggested Windows & Alternatives
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#1C2321]">
                  {selectedPassport.suggestedTimeWindows.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                  {selectedPassport.indoorAlternatives.map((alt) => (
                    <li key={alt} className="text-[#1B4332]">
                      {alt}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-[#D8E6DF]/35 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1B4332]">
                  Recommended Activities
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#1C2321]">
                  {selectedPassport.recommendedActivities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-[#FFEDD5]/55 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9A3412]">
                  Activities to Reconsider
                </h3>
                {selectedPassport.activitiesToReconsider.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#1C2321]">
                    {selectedPassport.activitiesToReconsider.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[#52605A]">
                    No major outdoor shifts required right now.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-[#1C2321]/10 bg-[#F3EFE6]/60 p-4 text-xs text-[#52605A] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p>
                  <strong className="text-[#1C2321]">Why:</strong> {selectedPassport.reasonsSummary}
                </p>
                <p className="mt-1">
                  <strong className="text-[#1C2321]">Forecast uncertainty:</strong>{' '}
                  {selectedPassport.forecastUncertainty}
                </p>
                {selectedPassport.totalRecommendedExposureProxyUgHr !== null && (
                  <p className="mt-1">
                    <strong className="text-[#1C2321]">Illustrative PM2.5 exposure proxy:</strong>{' '}
                    {selectedPassport.totalOriginalExposureProxyUgHr} {'->'}{' '}
                    {selectedPassport.totalRecommendedExposureProxyUgHr} µg/m³·hr (concentration × duration index, not a clinical dose)
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleUrgentSymptoms(selectedPassport.memberId)}
                className={`min-h-10 shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  selectedPassport.urgentCareTriggered
                    ? 'border-[#991B1B] bg-[#991B1B] text-white'
                    : 'border-[#991B1B]/30 bg-white text-[#991B1B]'
                }`}
              >
                {selectedPassport.urgentCareTriggered
                  ? 'Clear Urgent Symptom Flag'
                  : 'Flag Severe Breathing Difficulty'}
              </button>
            </div>
          </article>
        </div>
      )}

      {/* VIEW 2: ENTIRE FAMILY CARDS */}
      {viewMode === 'entire' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {passports.map((p) => (
            <article
              key={p.memberId}
              className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[#1C2321]">{p.memberName}</h2>
                  <p className="text-xs text-[#52605A]">{p.role}</p>
                </div>
                <PrecautionBadge tier={p.precautionTier} label={p.precautionLabel} />
              </div>
              <p className="mt-2.5 text-sm text-[#1C2321]">{p.todayOutlook}</p>
              <p className="mt-2 text-xs text-[#52605A]">
                <strong>Best Window:</strong> {p.suggestedTimeWindows[0]}
              </p>
              {p.activitiesToReconsider.length > 0 && (
                <p className="mt-1 text-xs text-[#9A3412]">
                  <strong>Adjust:</strong> {p.activitiesToReconsider.join('; ')}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectMember(p.memberId);
                  setViewMode('individual');
                }}
                className="mt-3 text-xs font-semibold text-[#1B4332] underline"
              >
                Open full passport
              </button>
            </article>
          ))}
        </div>
      )}

      {/* VIEW 3: SIDE-BY-SIDE COMPARISON */}
      {viewMode === 'compare' && (
        <div className="overflow-x-auto rounded-3xl border border-[#1C2321]/10 bg-white shadow-sm">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-[#1C2321]/10 bg-[#F3EFE6] text-xs uppercase text-[#52605A]">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Precaution Tier</th>
                <th className="px-4 py-3">Key Sensitivity</th>
                <th className="px-4 py-3">Primary Adjustment</th>
                <th className="px-4 py-3">Exposure Proxy <span className="normal-case">(µg/m³·hr)</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C2321]/10">
              {passports.map((p) => (
                <tr key={p.memberId} className="align-top">
                  <td className="px-4 py-3 font-semibold text-[#1C2321]">
                    {p.memberName}
                    <div className="text-xs font-normal text-[#52605A]">{p.role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PrecautionBadge tier={p.precautionTier} label={p.precautionLabel} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[#52605A]">
                    {p.sensitivityFactors.slice(0, 2).join('; ')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1C2321]">
                    {p.activitiesToReconsider[0] ?? p.recommendedActivities[0]}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[#1B4332]">
                    {p.totalOriginalExposureProxyUgHr !== null &&
                    p.totalRecommendedExposureProxyUgHr !== null
                      ? `${p.totalOriginalExposureProxyUgHr} -> ${p.totalRecommendedExposureProxyUgHr}`
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
