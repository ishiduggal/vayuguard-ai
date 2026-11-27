import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LocateFixed,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { PRESET_INDIAN_CITIES } from '../shared/presets.js';
import type {
  ActivityCategory,
  ActivityIntensity,
  AgeGroup,
  CityLocation,
  FamilyMember,
  Flexibility,
  HouseholdProfile,
  HouseholdResources,
  Language,
  MemberSensitivities,
  RoutineActivity,
  SensitivityAnswer,
  TransportMode,
} from '../shared/types.js';
import { URGENT_CARE_GUIDANCE } from '../engine/safetyRules.js';
import { formatHourLabel } from '../shared/aqi.js';

interface OnboardingFlowProps {
  initialProfile: HouseholdProfile;
  onComplete: (profile: HouseholdProfile) => void;
  onLoadPatialaDemo: () => void;
  onCancel?: () => void;
}

const DEFAULT_SENSITIVITIES: MemberSensitivities = {
  diagnosedAsthma: 'not_sure',
  dustOrSeasonalAllergy: 'not_sure',
  smokeOrCropBurningSensitivity: 'no',
  otherRespiratoryCondition: 'no',
  coldAirSensitivity: 'no',
  frequentIrritationDuringSmog: 'no',
  clinicianPrecautionsNote: '',
  urgentSymptomsReported: false,
};

const ACTIVITY_PRESETS: Array<{
  label: string;
  category: ActivityCategory;
  flexibility: Flexibility;
  preferredStartHour: number;
  durationMinutes: number;
  intensity: ActivityIntensity;
  isOutdoor: boolean;
  transportMode?: TransportMode;
  tripDistanceKm?: number;
}> = [
  {
    label: 'Morning walk',
    category: 'morning_walk',
    flexibility: 'flexible',
    preferredStartHour: 6,
    durationMinutes: 35,
    intensity: 'moderate',
    isOutdoor: true,
  },
  {
    label: 'School / University',
    category: 'school',
    flexibility: 'fixed',
    preferredStartHour: 8,
    durationMinutes: 360,
    intensity: 'low',
    isOutdoor: false,
    transportMode: 'car',
    tripDistanceKm: 7,
  },
  {
    label: 'Office commute',
    category: 'office_commute',
    flexibility: 'fixed',
    preferredStartHour: 9,
    durationMinutes: 40,
    intensity: 'low',
    isOutdoor: false,
    transportMode: 'car',
    tripDistanceKm: 8,
  },
  {
    label: 'Grocery shopping',
    category: 'grocery',
    flexibility: 'flexible',
    preferredStartHour: 11,
    durationMinutes: 45,
    intensity: 'low',
    isOutdoor: true,
    transportMode: 'car',
    tripDistanceKm: 5,
  },
  {
    label: 'Outdoor play / Exercise',
    category: 'outdoor_play',
    flexibility: 'flexible',
    preferredStartHour: 17,
    durationMinutes: 45,
    intensity: 'vigorous',
    isOutdoor: true,
  },
  {
    label: 'Cooking',
    category: 'cooking',
    flexibility: 'fixed',
    preferredStartHour: 7,
    durationMinutes: 60,
    intensity: 'low',
    isOutdoor: false,
  },
  {
    label: 'Home ventilation',
    category: 'ventilation',
    flexibility: 'flexible',
    preferredStartHour: 8,
    durationMinutes: 25,
    intensity: 'low',
    isOutdoor: false,
  },
  {
    label: 'Outdoor work',
    category: 'outdoor_work',
    flexibility: 'fixed',
    preferredStartHour: 10,
    durationMinutes: 120,
    intensity: 'moderate',
    isOutdoor: true,
  },
];

function createNewMember(index: number): FamilyMember {
  return {
    id: `member-${Date.now()}-${index}`,
    name: index === 0 ? 'Parent' : `Family Member ${index + 1}`,
    role: index === 0 ? 'Parent' : 'Household Member',
    ageGroup: 'adult',
    wakeHour: 6,
    sleepHour: 22,
    preferredLanguage: 'en',
    sensitivities: { ...DEFAULT_SENSITIVITIES },
    activities: [
      {
        id: `act-${Date.now()}-${index}-1`,
        title: 'Morning walk',
        category: 'morning_walk',
        flexibility: 'flexible',
        preferredStartHour: 6,
        durationMinutes: 30,
        intensity: 'moderate',
        isOutdoor: true,
      },
    ],
  };
}

export function OnboardingFlow({
  initialProfile,
  onComplete,
  onLoadPatialaDemo,
  onCancel,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<CityLocation>(initialProfile.location);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CityLocation[]>(PRESET_INDIAN_CITIES);
  const [geoStatus, setGeoStatus] = useState<string>('');
  const [householdName, setHouseholdName] = useState(
    initialProfile.householdName || 'My Family',
  );
  const [members, setMembers] = useState<FamilyMember[]>(
    initialProfile.members.length > 0 ? initialProfile.members : [createNewMember(0)],
  );
  const [activeMemberIdx, setActiveMemberIdx] = useState(0);
  const [resources, setResources] = useState<HouseholdResources>(initialProfile.resources);
  const [customActivityTitle, setCustomActivityTitle] = useState('');
  const [validationError, setValidationError] = useState('');

  const activeMember = members[activeMemberIdx] ?? members[0];

  async function handleCitySearch(q: string) {
    setSearchQuery(q);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as { results: CityLocation[] };
        setSearchResults(data.results);
      }
    } catch {
      setSearchResults(
        PRESET_INDIAN_CITIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
      );
    }
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('Browser geolocation is unavailable; please pick or search your city.');
      return;
    }
    setGeoStatus('Checking device location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          id: `geo-device`,
          name: `Detected Locality (${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°)`,
          state: 'India',
          country: 'India',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
          detectionMethod: 'geolocation',
          confirmed: false,
        });
        setGeoStatus('Location detected — please confirm below or pick a city name.');
      },
      () => {
        setGeoStatus('Permission denied or unavailable — select a city below.');
      },
      { timeout: 6000 },
    );
  }

  function updateActiveMember(patch: Partial<FamilyMember>) {
    setMembers((prev) =>
      prev.map((m, idx) => (idx === activeMemberIdx ? { ...m, ...patch } : m)),
    );
  }

  function updateActiveSensitivity(key: keyof MemberSensitivities, val: SensitivityAnswer | string | boolean) {
    setMembers((prev) =>
      prev.map((m, idx) =>
        idx === activeMemberIdx
          ? { ...m, sensitivities: { ...m.sensitivities, [key]: val } }
          : m,
      ),
    );
  }

  function addPresetActivity(preset: (typeof ACTIVITY_PRESETS)[number]) {
    if (!activeMember) return;
    const newAct: RoutineActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: preset.label,
      category: preset.category,
      flexibility: preset.flexibility,
      preferredStartHour: preset.preferredStartHour,
      durationMinutes: preset.durationMinutes,
      intensity: preset.intensity,
      isOutdoor: preset.isOutdoor,
      transportMode: preset.transportMode,
      tripDistanceKm: preset.tripDistanceKm,
    };
    updateActiveMember({ activities: [...activeMember.activities, newAct] });
  }

  function addCustomActivity() {
    const title = customActivityTitle.trim();
    if (!title || !activeMember) return;
    const newAct: RoutineActivity = {
      id: `act-${Date.now()}`,
      title,
      category: 'custom',
      flexibility: 'flexible',
      preferredStartHour: 10,
      durationMinutes: 30,
      intensity: 'moderate',
      isOutdoor: true,
    };
    updateActiveMember({ activities: [...activeMember.activities, newAct] });
    setCustomActivityTitle('');
  }

  function nextStep() {
    setValidationError('');
    if (step === 2) {
      if (members.length === 0) {
        setValidationError('Please keep at least one household member.');
        return;
      }
      if (members.some((m) => !m.name.trim())) {
        setValidationError('Please enter a name or nickname for each family member.');
        return;
      }
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      onComplete({
        ...initialProfile,
        householdName: householdName.trim() || 'My Family',
        isDemo: false,
        location: { ...location, confirmed: true },
        members,
        resources,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      {/* Top Hero & One-Click 60s Judge Demo */}
      <div className="mb-6 rounded-3xl border border-[#1B4332]/15 bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-5 text-[#FBF9F5] shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D8E6DF]">
              VayuGuard AI · Every Breath, Every Family
            </p>
            <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold">
              Build your Family Air Health Passport
            </h1>
            <p className="mt-1 text-sm text-[#D8E6DF]">
              No account needed. Takes ~60 seconds. Your profile is saved on this device. Assistant sharing is explained before you ask.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={onLoadPatialaDemo}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#FBF9F5] px-4 py-2.5 text-sm font-semibold text-[#1B4332] shadow-sm transition hover:bg-[#F3EFE6]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Try 60s Patiala Family Demo
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-medium text-[#D8E6DF] underline underline-offset-2"
              >
                Return to current passport
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs font-medium text-[#52605A]">
          <span>Step {step} of 5</span>
          <span>
            {step === 1 && 'Location'}
            {step === 2 && 'Household'}
            {step === 3 && 'Sensitivities (Optional)'}
            {step === 4 && 'Daily Routine'}
            {step === 5 && 'Home Resources (Optional)'}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F3EFE6]">
          <div
            className="h-full rounded-full bg-[#1B4332] transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-[#1C2321]/10 bg-white p-5 shadow-sm sm:p-7">
        {/* STEP 1: LOCATION */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-[#1C2321]">Where does your family live?</h2>
              <p className="mt-1 text-sm text-[#52605A]">
                We use local air quality and boundary-layer weather forecasts for your city. You can change this anytime.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-[#52605A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => void handleCitySearch(e.target.value)}
                  placeholder="Search city (e.g. Patiala, Ludhiana, Delhi)"
                  aria-label="Search city or locality"
                  className="min-h-12 w-full rounded-2xl border border-[#1C2321]/15 bg-[#FBF9F5] pl-11 pr-4 text-sm focus:border-[#1B4332] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#1B4332]/20 bg-[#F3EFE6] px-4 text-sm font-semibold text-[#1B4332] transition hover:bg-[#D8E6DF]"
              >
                <LocateFixed className="h-4 w-4" />
                Use device location
              </button>
            </div>

            {geoStatus && <p className="text-xs text-[#52605A]">{geoStatus}</p>}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#52605A]">
                Quick Select Cities
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {searchResults.map((city) => {
                  const selected =
                    Math.abs(city.latitude - location.latitude) < 0.05 &&
                    Math.abs(city.longitude - location.longitude) < 0.05;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => setLocation({ ...city, confirmed: true })}
                      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition ${
                        selected
                          ? 'border-[#1B4332] bg-[#D8E6DF]/60 text-[#1B4332]'
                          : 'border-[#1C2321]/10 bg-[#FBF9F5] hover:bg-[#F3EFE6]'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold">{city.name}</div>
                        <div className="text-xs text-[#52605A]">
                          {city.state}, {city.country}
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-[#1B4332]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F3EFE6] p-3.5 text-sm">
              <span className="font-semibold text-[#1B4332]">Confirmed Location:</span>{' '}
              {location.name}, {location.state} ({location.latitude.toFixed(2)}°,{' '}
              {location.longitude.toFixed(2)}°)
            </div>
          </div>
        )}

        {/* STEP 2: HOUSEHOLD */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Who lives in your household?</h2>
              <p className="mt-1 text-sm text-[#52605A]">
                Each family member gets a distinct daily plan based on their age, schedule, and sensitivities.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#52605A]">
                Household Name (Optional)
              </label>
              <input
                type="text"
                aria-label="Household name"
                      value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-2xl border border-[#1C2321]/15 bg-[#FBF9F5] px-4 text-sm"
                placeholder="e.g., Gill Family"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {members.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMemberIdx(idx)}
                  className={`min-h-11 rounded-2xl border px-3.5 py-2 text-sm font-medium transition ${
                    idx === activeMemberIdx
                      ? 'border-[#1B4332] bg-[#1B4332] text-white'
                      : 'border-[#1C2321]/15 bg-[#FBF9F5] text-[#1C2321]'
                  }`}
                >
                  {m.name || `Member ${idx + 1}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = createNewMember(members.length);
                  setMembers([...members, next]);
                  setActiveMemberIdx(members.length);
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-dashed border-[#1B4332]/40 px-3.5 py-2 text-sm font-semibold text-[#1B4332] hover:bg-[#D8E6DF]/40"
              >
                <UserPlus className="h-4 w-4" />
                Add member
              </button>
            </div>

            {activeMember && (
              <div className="space-y-4 rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1B4332]">
                    Editing Member {activeMemberIdx + 1}
                  </span>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = members.filter((_, i) => i !== activeMemberIdx);
                        setMembers(updated);
                        setActiveMemberIdx(Math.max(0, activeMemberIdx - 1));
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#991B1B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Name or nickname</label>
                    <input
                      type="text"
                      aria-label="Name or nickname"
                      value={activeMember.name}
                      onChange={(e) => updateActiveMember({ name: e.target.value })}
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Role / Occupation</label>
                    <input
                      type="text"
                      aria-label="Role / Occupation"
                      value={activeMember.role}
                      onChange={(e) => updateActiveMember({ role: e.target.value })}
                      placeholder="e.g., School child, Office commuter"
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Age group</label>
                    <select
                      aria-label="Age group"
                      value={activeMember.ageGroup}
                      onChange={(e) => updateActiveMember({ ageGroup: e.target.value as AgeGroup })}
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    >
                      <option value="infant_toddler">Infant / Toddler (0–4)</option>
                      <option value="child">School Child (5–12)</option>
                      <option value="teen_student">Teen / University Student</option>
                      <option value="adult">Adult</option>
                      <option value="older_adult">Older Adult (60+)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Preferred language</label>
                    <select
                      aria-label="Preferred language"
                      value={activeMember.preferredLanguage}
                      onChange={(e) =>
                        updateActiveMember({ preferredLanguage: e.target.value as Language })
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                      <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                      <option value="pa_roman">Roman Punjabi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Typical wake-up hour</label>
                    <select
                      aria-label="Typical wake-up hour"
                      value={activeMember.wakeHour}
                      onChange={(e) => updateActiveMember({ wakeHour: Number(e.target.value) })}
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    >
                      {Array.from({length:24}, (_, i) => i).map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#52605A]">Typical sleep hour</label>
                    <select
                      aria-label="Typical sleep hour"
                      value={activeMember.sleepHour}
                      onChange={(e) => updateActiveMember({ sleepHour: Number(e.target.value) })}
                      className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                    >
                      {Array.from({length:24}, (_, i) => i).map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: SENSITIVITIES */}
        {step === 3 && activeMember && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">
                  Sensitivities for {activeMember.name}
                </h2>
                <p className="mt-1 text-sm text-[#52605A]">
                  All questions are optional. VayuGuard never diagnoses medical conditions or replaces clinician care.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs font-semibold text-[#1B4332] underline"
              >
                Skip this step
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {members.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMemberIdx(idx)}
                  className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${
                    idx === activeMemberIdx
                      ? 'border-[#1B4332] bg-[#1B4332] text-white'
                      : 'border-[#1C2321]/15 bg-[#FBF9F5]'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {(
                [
                  ['diagnosedAsthma', 'Does this person have diagnosed asthma?'],
                  ['dustOrSeasonalAllergy', 'Do they experience dust or seasonal allergies?'],
                  ['smokeOrCropBurningSensitivity', 'Are they sensitive to smoke or crop-residue haze?'],
                  ['otherRespiratoryCondition', 'Do they have an existing respiratory condition?'],
                  ['coldAirSensitivity', 'Are they particularly sensitive to cold morning/night air?'],
                  ['frequentIrritationDuringSmog', 'Do they frequently get sneezing, coughing, or irritation during polluted periods?'],
                ] as Array<[keyof MemberSensitivities, string]>
              ).map(([field, label]) => (
                <div
                  key={field}
                  className="rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-3.5"
                >
                  <p className="text-sm font-medium text-[#1C2321]">{label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        ['yes', 'Yes'],
                        ['no', 'No'],
                        ['not_sure', 'Not sure'],
                        ['prefer_not_to_answer', 'Prefer not to answer'],
                      ] as Array<[SensitivityAnswer, string]>
                    ).map(([optVal, optLabel]) => {
                      const active = activeMember.sensitivities[field] === optVal;
                      return (
                        <button
                          key={optVal}
                          aria-pressed={active}
                          type="button"
                          onClick={() => updateActiveSensitivity(field, optVal)}
                          className={`min-h-10 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? 'border-[#1B4332] bg-[#D8E6DF] text-[#1B4332]'
                              : 'border-[#1C2321]/10 bg-white text-[#52605A]'
                          }`}
                        >
                          {optLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-3.5">
                <label className="block text-sm font-medium text-[#1C2321]">
                  Clinician-provided precautions (Optional)
                </label>
                <input
                  type="text"
                  aria-label="Clinician-provided precautions"
                      value={activeMember.sensitivities.clinicianPrecautionsNote}
                  onChange={(e) =>
                    updateActiveSensitivity('clinicianPrecautionsNote', e.target.value)
                  }
                  placeholder="e.g., Carry prescribed reliever inhaler on cold mornings"
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-white px-3 text-sm"
                />
              </div>

              <div className="rounded-2xl border border-[#991B1B]/25 bg-[#FEE2E2]/45 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={activeMember.sensitivities.urgentSymptomsReported}
                    onChange={(e) =>
                      updateActiveSensitivity('urgentSymptomsReported', e.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-[#991B1B]"
                  />
                  <span className="text-sm text-[#991B1B]">
                    <strong>Urgent check:</strong> Is {activeMember.name} having severe breathing difficulty, chest tightness, or persistent wheezing right now?
                  </span>
                </label>
                {activeMember.sensitivities.urgentSymptomsReported && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-white p-3 text-xs text-[#991B1B]">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{URGENT_CARE_GUIDANCE}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: DAILY ROUTINE */}
        {step === 4 && activeMember && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Daily routine for {activeMember.name}</h2>
              <p className="mt-1 text-sm text-[#52605A]">
                Tap activities to add, and mark whether each time is <strong>Fixed</strong> (like 8 AM school) or <strong>Flexible</strong> (like walks or groceries).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {members.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMemberIdx(idx)}
                  className={`min-h-10 rounded-xl border px-3 text-xs font-semibold ${
                    idx === activeMemberIdx
                      ? 'border-[#1B4332] bg-[#1B4332] text-white'
                      : 'border-[#1C2321]/15 bg-[#FBF9F5]'
                  }`}
                >
                  {m.name} ({m.activities.length})
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#52605A]">
                Add Common Activities
              </p>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => addPresetActivity(p)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#1B4332]/20 bg-[#F3EFE6] px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#D8E6DF]"
                  >
                    <Plus className="h-3.5 w-3.5" /> {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={customActivityTitle}
                onChange={(e) => setCustomActivityTitle(e.target.value)}
                placeholder="Add custom activity (e.g., Tuition drop-off)"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
              />
              <button
                type="button"
                onClick={addCustomActivity}
                className="min-h-11 rounded-xl bg-[#1B4332] px-4 text-sm font-semibold text-white"
              >
                Add
              </button>
            </div>

            <div className="space-y-2.5">
              {activeMember.activities.map((act) => (
                <div
                  key={act.id}
                  className="rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{act.title}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveMember({
                          activities: activeMember.activities.filter((a) => a.id !== act.id),
                        })
                      }
                      className="text-xs text-[#991B1B]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs">Duration (minutes)
                      <input aria-label={`${act.title} duration minutes`} type="number" min={1} max={1440} value={act.durationMinutes}
                        onChange={e => updateActiveMember({activities: activeMember.activities.map(a => a.id === act.id ? {...a, durationMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1))} : a)})}
                        className="mt-1 min-h-10 w-full rounded-xl border px-2" />
                    </label>
                    <label className="text-xs">Travel mode
                      <select aria-label={`${act.title} transport mode`} value={act.transportMode ?? 'none'}
                        onChange={e => updateActiveMember({activities: activeMember.activities.map(a => a.id === act.id ? {...a, transportMode: e.target.value === 'none' ? undefined : e.target.value as TransportMode} : a)})}
                        className="mt-1 min-h-10 w-full rounded-xl border px-2">
                        <option value="none">Not a trip</option><option value="car">Car</option><option value="two_wheeler">Two-wheeler</option><option value="public_transit">Public transit</option><option value="carpool">Carpool</option><option value="walk_cycle">Walk / cycle</option><option value="remote">Remote</option>
                      </select>
                    </label>
                    {act.transportMode && <label className="text-xs">One-way distance (km)
                      <input aria-label={`${act.title} trip distance km`} type="number" min={0} max={1000} value={act.tripDistanceKm ?? 0}
                        onChange={e => updateActiveMember({activities: activeMember.activities.map(a => a.id === act.id ? {...a, tripDistanceKm: Math.max(0, Math.min(1000, Number(e.target.value) || 0))} : a)})}
                        className="mt-1 min-h-10 w-full rounded-xl border px-2" />
                    </label>}
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <select
                      aria-label={`${act.title} flexibility`}
                      value={act.flexibility}
                      onChange={(e) =>
                        updateActiveMember({
                          activities: activeMember.activities.map((a) =>
                            a.id === act.id
                              ? { ...a, flexibility: e.target.value as Flexibility }
                              : a,
                          ),
                        })
                      }
                      className="min-h-10 rounded-xl border border-[#1C2321]/15 bg-white px-2.5 text-xs"
                    >
                      <option value="flexible">Flexible</option>
                      <option value="fixed">Fixed time</option>
                    </select>

                    <select
                      aria-label={`${act.title} start time`}
                      value={act.preferredStartHour}
                      onChange={(e) =>
                        updateActiveMember({
                          activities: activeMember.activities.map((a) =>
                            a.id === act.id
                              ? { ...a, preferredStartHour: Number(e.target.value) }
                              : a,
                          ),
                        })
                      }
                      className="min-h-10 rounded-xl border border-[#1C2321]/15 bg-white px-2.5 text-xs"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <option key={h} value={h}>
                          {formatHourLabel(h)}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label={`${act.title} intensity`}
                      value={act.intensity}
                      onChange={(e) =>
                        updateActiveMember({
                          activities: activeMember.activities.map((a) =>
                            a.id === act.id
                              ? { ...a, intensity: e.target.value as ActivityIntensity }
                              : a,
                          ),
                        })
                      }
                      className="min-h-10 rounded-xl border border-[#1C2321]/15 bg-white px-2.5 text-xs"
                    >
                      <option value="low">Light</option>
                      <option value="moderate">Moderate</option>
                      <option value="vigorous">Vigorous</option>
                    </select>

                    <select
                      aria-label={`${act.title} setting`}
                      value={act.isOutdoor ? 'outdoor' : 'indoor'}
                      onChange={(e) =>
                        updateActiveMember({
                          activities: activeMember.activities.map((a) =>
                            a.id === act.id ? { ...a, isOutdoor: e.target.value === 'outdoor' } : a,
                          ),
                        })
                      }
                      className="min-h-10 rounded-xl border border-[#1C2321]/15 bg-white px-2.5 text-xs"
                    >
                      <option value="outdoor">Outdoor</option>
                      <option value="indoor">Indoor / Commute</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: HOUSEHOLD RESOURCES */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Home resources & habits (Optional)</h2>
              <p className="mt-1 text-sm text-[#52605A]">
                We never assume you own expensive gear. Free and low-cost actions always come first.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(
                [
                  ['hasAirPurifier', 'Air purifier at home'],
                  ['hasAirConditioning', 'Air conditioning (recirculation)'],
                  ['hasExhaustFan', 'Kitchen exhaust fan / chimney'],
                  ['hasIndoorSensor', 'Indoor PM2.5 air sensor'],
                  ['hasPublicTransitAccess', 'Access to bus / metro / shared transit'],
                  ['limitedBudget', 'Limited budget for extra gear'],
                  ['usesIncenseOrDhoop', 'Daily incense / dhoop indoors'],
                  ['indoorSmoking', 'Someone smokes indoors'],
                ] as Array<[keyof HouseholdResources, string]>
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-[#1C2321]/10 bg-[#FBF9F5] px-4 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(resources[key])}
                    onChange={(e) =>
                      setResources((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#1B4332]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {resources.hasIndoorSensor && <label className="block text-sm">Reported indoor PM2.5 (µg/m³; optional)
              <input aria-label="Reported indoor PM2.5" type="number" min={0} max={5000} value={resources.measuredIndoorPm25 ?? ''}
                onChange={e => setResources(r => ({...r, measuredIndoorPm25: e.target.value === '' ? null : Math.max(0, Math.min(5000, Number(e.target.value)))}))}
                className="mt-1 min-h-11 w-full rounded-xl border px-3" />
            </label>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[#52605A]">Primary cooking fuel</label>
                <select
                  aria-label="Primary cooking fuel"
                      value={resources.cookingType}
                  onChange={(e) =>
                    setResources((prev) => ({
                      ...prev,
                      cookingType: e.target.value as HouseholdResources['cookingType'],
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
                >
                  <option value="lpg_gas">LPG Gas Stove</option>
                  <option value="electric_induction">Electric / Induction</option>
                  <option value="solid_biomass">Wood / Biomass / Coal</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#52605A]">Floor cleaning method</label>
                <select
                  aria-label="Floor cleaning method"
                      value={resources.sweepingMethod}
                  onChange={(e) =>
                    setResources((prev) => ({
                      ...prev,
                      sweepingMethod: e.target.value as HouseholdResources['sweepingMethod'],
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#1C2321]/15 bg-[#FBF9F5] px-3 text-sm"
                >
                  <option value="wet_mop">Wet mop (Pocha)</option>
                  <option value="dry_broom">Dry broom (Jhadu)</option>
                  <option value="vacuum">Vacuum</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {validationError && (
          <p className="mt-4 rounded-xl bg-[#FEE2E2] px-3.5 py-2 text-sm text-[#991B1B]">
            {validationError}
          </p>
        )}

        {/* Footer Controls */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#1C2321]/10 pt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-[#1C2321]/15 px-4 text-sm font-medium text-[#1C2321] disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <button
            type="button"
            onClick={nextStep}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#1B4332] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2D6A4F]"
          >
            {step === 5 ? 'Create Family Passport' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
