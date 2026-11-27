import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Home as HomeIcon,
  MessageSquareHeart,
  Sun,
  Users,
} from 'lucide-react';
import {
  buildIndoorAirPlan,
  buildMemberPassport,
  buildSeasonalOutlook,
  buildSimulatedSpikeEnvironment,
  calculateGreenImpact,
  compareForecastsAndRepair,
  solveHouseholdConflicts,
} from './engine/index.js';
import {
  buildOfflineFallbackEnvironment,
  createPatialaDemoHousehold,
  PRESET_INDIAN_CITIES,
} from './shared/presets.js';
import type {
  CityLocation,
  EnvironmentBundle,
  HouseholdProfile,
  SeasonalOutlookResult,
} from './shared/types.js';
import {
  clearStoredHousehold,
  createEmptyHousehold,
  loadStoredHousehold,
  saveHouseholdToStorage,
} from './utils/storage.js';
import { AssistantScreen } from './components/AssistantScreen.js';
import { FamilyScreen } from './components/FamilyScreen.js';
import { HomeScreen } from './components/HomeScreen.js';
import { OnboardingFlow } from './components/OnboardingFlow.js';
import { RoutineScreen } from './components/RoutineScreen.js';
import { TodayScreen, type NavTab } from './components/TodayScreen.js';

export function App() {
  const [household, setHousehold] = useState<HouseholdProfile | null>(() => loadStoredHousehold());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => loadStoredHousehold() === null);
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [tourStep, setTourStep] = useState(0);
  const requestVersion = useRef(0);
  const liveRef = useRef<EnvironmentBundle | null>(null);
  const [idlingMinutesSaved, setIdlingMinutesSaved] = useState<number>(25);

  const initialLoc = household?.location ?? PRESET_INDIAN_CITIES[0];
  const [liveEnv, setLiveEnv] = useState<EnvironmentBundle>(() =>
    buildOfflineFallbackEnvironment(initialLoc),
  );
  const [previousEnv, setPreviousEnv] = useState<EnvironmentBundle | null>(null);
  const [simulatedEnv, setSimulatedEnv] = useState<EnvironmentBundle | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalOutlookResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const activeEnv = simulatedEnv ?? liveEnv;

  const fetchCityData = useCallback(async (loc: CityLocation, force = false) => {
    const version = ++requestVersion.current;
    setIsRefreshing(true);
    const changedCity = liveRef.current?.location.latitude !== loc.latitude || liveRef.current?.location.longitude !== loc.longitude;
    if (changedCity) {
      setLiveEnv(buildOfflineFallbackEnvironment(loc));
      setPreviousEnv(null); setSimulatedEnv(null); setSeasonalData(null);
    }
    const qs = new URLSearchParams({lat: String(loc.latitude), lon: String(loc.longitude), name: loc.name,
      state: loc.state, country: loc.country, timezone: loc.timezone, ...(force ? {force:'1'} : {})});
    void fetch(`/api/seasonal?${qs}`, {signal: AbortSignal.timeout(30000)}).then(async res => {
      if (res.ok) { const data = await res.json() as SeasonalOutlookResult;
        if (version === requestVersion.current) setSeasonalData(data); }
    }).catch(() => {});
    try {
      const res = await fetch(`/api/environment?${qs}`, {signal: AbortSignal.timeout(30000)});
      if (!res.ok) throw new Error('Forecast unavailable');
      const next = await res.json() as EnvironmentBundle;
      if (version !== requestVersion.current) return;
      const prev = liveRef.current;
      if (prev && prev.location.latitude === loc.latitude && prev.location.longitude === loc.longitude &&
          prev.dataKind === next.dataKind && prev.fetchedAt !== next.fetchedAt) setPreviousEnv(prev);
      liveRef.current = next; setLiveEnv(next);
    } catch {
      if (version === requestVersion.current) setLiveEnv(prev => ({...prev, isStale:true, staleReason:'Refresh failed. Displayed data may be outdated; retry when connected.'}));
    } finally { if (version === requestVersion.current) setIsRefreshing(false); }
  }, []);

  const currentLoc = household?.location ?? PRESET_INDIAN_CITIES[0];
  useEffect(() => {
    void fetchCityData(currentLoc, false);
    const timer = window.setInterval(() => void fetchCityData(currentLoc, true), 10 * 60 * 1000);
    return () => { window.clearInterval(timer); };
  }, [currentLoc, fetchCityData]);

  const updateHousehold = useCallback((next: HouseholdProfile) => {
    setHousehold(next);
    saveHouseholdToStorage(next);
  }, []);

  const handleLoadPatialaDemo = useCallback(() => {
    const demo = createPatialaDemoHousehold();
    updateHousehold(demo);
    setSimulatedEnv(null);
    setPreviousEnv(null);
    setSelectedMemberId(demo.members[0]?.id ?? '');
    setShowOnboarding(false);
    setActiveTab('today');
  }, [updateHousehold]);

  const handleDeleteAllData = useCallback(() => {
    clearStoredHousehold();
    setHousehold(null);
    setSimulatedEnv(null);
    setPreviousEnv(null);
    setShowOnboarding(true);
  }, []);

  const effectiveHousehold = household ?? createPatialaDemoHousehold();

  const passports = useMemo(
    () =>
      effectiveHousehold.members.map((m) =>
        buildMemberPassport(m, activeEnv, effectiveHousehold.resources),
      ),
    [effectiveHousehold, activeEnv],
  );

  const conflictResult = useMemo(
    () => solveHouseholdConflicts(effectiveHousehold, passports, activeEnv),
    [effectiveHousehold, passports, activeEnv],
  );

  const planRepair = useMemo(() => {
    const baseline = simulatedEnv ? liveEnv : previousEnv;
    if (!baseline) return null;
    return compareForecastsAndRepair(effectiveHousehold, baseline, activeEnv);
  }, [effectiveHousehold, simulatedEnv, liveEnv, previousEnv, activeEnv]);

  const indoorPlan = useMemo(
    () => buildIndoorAirPlan(effectiveHousehold.resources, activeEnv),
    [effectiveHousehold.resources, activeEnv],
  );

  const greenImpact = useMemo(
    () => calculateGreenImpact(effectiveHousehold, conflictResult, activeEnv, idlingMinutesSaved),
    [effectiveHousehold, conflictResult, activeEnv, idlingMinutesSaved],
  );

  const seasonalOutlook = useMemo(
    () => {
      const current = buildSeasonalOutlook(activeEnv);
      return seasonalData ? { ...seasonalData, currentObservationSummary: current.currentObservationSummary, shortTermForecastSummary: current.shortTermForecastSummary } : current;
    },
    [seasonalData, activeEnv],
  );

  if (showOnboarding || !household) {
    return (
      <main className="min-h-screen bg-[#FBF9F5]">
        <OnboardingFlow
          initialProfile={household ?? createEmptyHousehold()}
          onComplete={(profile) => {
            updateHousehold(profile);
            setSelectedMemberId(profile.members[0]?.id ?? '');
            setShowOnboarding(false);
            setActiveTab('today');
          }}
          onLoadPatialaDemo={handleLoadPatialaDemo}
          onCancel={household ? () => setShowOnboarding(false) : undefined}
        />
      </main>
    );
  }

  const NAV_ITEMS: Array<{ id: NavTab; label: string; Icon: typeof Sun }> = [
    { id: 'today', label: 'Today', Icon: Sun },
    { id: 'family', label: 'Family', Icon: Users },
    { id: 'routine', label: 'Routine', Icon: CalendarClock },
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'assistant', label: 'Assistant', Icon: MessageSquareHeart },
  ];

  const effectiveSelectedMemberId =
    selectedMemberId && effectiveHousehold.members.some((m) => m.id === selectedMemberId)
      ? selectedMemberId
      : effectiveHousehold.members[0]?.id ?? '';

  return (
    <div className="min-h-screen bg-[#FBF9F5] pb-24 md:flex md:pb-0">
      {/* Desktop Left Navigation Rail */}
      <aside className="hidden md:flex md:w-56 lg:w-64 md:shrink-0 md:flex-col md:justify-between md:border-r md:border-[#1C2321]/10 md:bg-white md:p-5">
        <div>
          <div className="px-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#2D6A4F]">
              VayuGuard AI
            </p>
            <p className="font-[var(--font-display)] text-lg font-semibold text-[#1C2321]">
              Every Breath, Every Family
            </p>
          </div>

          <nav aria-label="Main navigation" className="mt-6 space-y-1.5">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => { setActiveTab(id); window.scrollTo(0, 0); }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-[#1B4332] text-white shadow-sm'
                      : 'text-[#52605A] hover:bg-[#F3EFE6] hover:text-[#1C2321]'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="rounded-2xl bg-[#F3EFE6] p-3.5 text-xs text-[#52605A]">
          <p className="font-semibold text-[#1C2321]">Non-Clinical Guidance</p>
          <p className="mt-1">
            Converts environmental forecasts into daily household precautions. Never diagnoses or replaces medical care.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-7">
        {tourStep > 0 && (
          <section aria-label="Judge tour" className="mb-5 rounded-2xl bg-[#D8E6DF] p-4 text-sm">
            <p className="font-semibold">Reviewer tour · Step {tourStep} of 5</p>
            <p>{['', 'Inspect the data source and family outlook.', 'Compare the family passports and their different constraints.', 'Inspect shared-trip candidates and the unchanged fixed commitments.', 'Inspect the simulated forecast and Before / Updated recommendations.', 'Review indoor guidance and the emissions scenario.'][tourStep]}</p>
            <button className="mt-2 min-h-11 rounded-xl bg-[#1B4332] px-4 text-white" onClick={() => {
              const next = tourStep + 1;
              if (next > 5) { setTourStep(0); setSimulatedEnv(null); setActiveTab('assistant'); return; }
              setTourStep(next);
              setActiveTab(next === 2 ? 'family' : next === 5 ? 'home' : 'routine');
              if (next === 4) setSimulatedEnv(buildSimulatedSpikeEnvironment(liveEnv));
            }}>{tourStep === 5 ? 'Finish tour · Open Assistant' : 'Next tour step'}</button>
            <button className="ml-3 min-h-11" onClick={() => { setTourStep(0); setSimulatedEnv(null); }}>End tour</button>
          </section>
        )}
        {activeTab === 'today' && (
          <TodayScreen
            household={effectiveHousehold}
            environment={activeEnv}
            passports={passports}
            conflictResult={conflictResult}
            planRepair={planRepair}
            isRefreshing={isRefreshing}
            onRefresh={() => void fetchCityData(effectiveHousehold.location, true)}
            onNavigate={setActiveTab}
            onSelectMemberAndNavigate={(memberId, tab) => {
              setSelectedMemberId(memberId);
              setActiveTab(tab);
            }}
            onTriggerSimulatedSpike={() => setSimulatedEnv(buildSimulatedSpikeEnvironment(liveEnv))}
            onClearSimulation={() => setSimulatedEnv(null)}
            onLoadPatialaDemo={handleLoadPatialaDemo}
            onEditOnboarding={() => setShowOnboarding(true)}
            onStartTour={() => setTourStep(1)}
          />
        )}

        {activeTab === 'family' && (
          <FamilyScreen
            household={effectiveHousehold}
            passports={passports}
            selectedMemberId={effectiveSelectedMemberId}
            onSelectMember={setSelectedMemberId}
            onUpdateHousehold={updateHousehold}
            onDeleteAllHouseholdData={handleDeleteAllData}
          />
        )}

        {activeTab === 'routine' && (
          <RoutineScreen
            household={effectiveHousehold}
            environment={activeEnv}
            passports={passports}
            conflictResult={conflictResult}
            planRepair={planRepair}
            selectedMemberId={effectiveSelectedMemberId}
            onSelectMember={setSelectedMemberId}
            onUpdateHousehold={updateHousehold}
            onTriggerSimulatedSpike={() => setSimulatedEnv(buildSimulatedSpikeEnvironment(liveEnv))}
            onClearSimulation={() => setSimulatedEnv(null)}
            onRefreshLive={() => void fetchCityData(effectiveHousehold.location, true)}
            isRefreshing={isRefreshing}
          />
        )}

        {activeTab === 'home' && (
          <HomeScreen
            household={effectiveHousehold}
            environment={activeEnv}
            indoorPlan={indoorPlan}
            greenImpact={greenImpact}
            seasonalOutlook={seasonalOutlook}
            idlingMinutesSaved={idlingMinutesSaved}
            onChangeIdlingMinutes={setIdlingMinutesSaved}
            onToggleChecklistItem={(itemId) => {
              const current = effectiveHousehold.completedIndoorChecklistIds;
              const next = current.includes(itemId)
                ? current.filter((x) => x !== itemId)
                : [...current, itemId];
              updateHousehold({
                ...effectiveHousehold,
                completedIndoorChecklistIds: next,
              });
            }}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantScreen
            household={effectiveHousehold}
            environment={activeEnv}
            passports={passports}
            conflictResult={conflictResult}
            planRepair={planRepair}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (5 Destinations) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1C2321]/10 bg-white/95 px-2 py-1.5 backdrop-blur md:hidden"
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
                  onClick={() => { setActiveTab(id); window.scrollTo(0, 0); }}
              className={`flex min-h-12 min-w-14 flex-col items-center justify-center rounded-2xl px-2 text-[11px] font-semibold ${
                active ? 'text-[#1B4332]' : 'text-[#52605A]'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`}
                aria-hidden="true"
              />
              <span className="mt-0.5">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
export default App;
