export type Language = 'en' | 'hi' | 'pa' | 'pa_roman';

export type SensitivityAnswer = 'yes' | 'no' | 'not_sure' | 'prefer_not_to_answer';

export type AgeGroup = 'infant_toddler' | 'child' | 'teen_student' | 'adult' | 'older_adult';

export type ActivityIntensity = 'low' | 'moderate' | 'vigorous';

export type ActivityCategory =
  | 'morning_walk'
  | 'school'
  | 'office_commute'
  | 'outdoor_work'
  | 'exercise'
  | 'grocery'
  | 'cooking'
  | 'ventilation'
  | 'outdoor_play'
  | 'custom';

export type Flexibility = 'fixed' | 'flexible';

export type TransportMode = 'car' | 'two_wheeler' | 'public_transit' | 'carpool' | 'walk_cycle' | 'remote';

export type PrecautionTier = 'low' | 'moderate' | 'high' | 'stay_indoors';

export type DataKind =
  | 'modeled_forecast'
  | 'historical_modeled'
  | 'simulated_scenario'
  | 'fallback_offline';

export interface CityLocation {
  id: string;
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  detectionMethod: 'preset' | 'search' | 'geolocation' | 'manual';
  confirmed: boolean;
}

export interface HourlyEnvironmentPoint {
  time: string;
  hour: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
  dust: number | null;
  usAqi: number | null;
  europeanAqi: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  precipitationMm: number | null;
  precipitationProbPct: number | null;
  visibilityM: number | null;
  boundaryLayerHeightM: number | null;
  weatherCode: number | null;
}

export interface EnvironmentBundle {
  location: CityLocation;
  source: string;
  dataKind: DataKind;
  aqiStandard: string;
  fetchedAt: string;
  forecastHorizonHours: number;
  isStale: boolean;
  staleReason?: string;
  simulationLabel?: string;
  missingFields: string[];
  current: HourlyEnvironmentPoint;
  hourly: HourlyEnvironmentPoint[];
}

export interface MemberSensitivities {
  diagnosedAsthma: SensitivityAnswer;
  dustOrSeasonalAllergy: SensitivityAnswer;
  smokeOrCropBurningSensitivity: SensitivityAnswer;
  otherRespiratoryCondition: SensitivityAnswer;
  coldAirSensitivity: SensitivityAnswer;
  frequentIrritationDuringSmog: SensitivityAnswer;
  clinicianPrecautionsNote: string;
  urgentSymptomsReported: boolean;
}

export interface RoutineActivity {
  id: string;
  title: string;
  category: ActivityCategory;
  flexibility: Flexibility;
  preferredStartHour: number;
  durationMinutes: number;
  intensity: ActivityIntensity;
  isOutdoor: boolean;
  transportMode?: TransportMode;
  tripDistanceKm?: number;
  notes?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  ageGroup: AgeGroup;
  wakeHour: number;
  sleepHour: number;
  preferredLanguage: Language;
  sensitivities: MemberSensitivities;
  activities: RoutineActivity[];
}

export interface HouseholdResources {
  hasAirPurifier: boolean;
  hasAirConditioning: boolean;
  hasExhaustFan: boolean;
  hasIndoorSensor: boolean;
  measuredIndoorPm25: number | null;
  hasPublicTransitAccess: boolean;
  limitedBudget: boolean;
  cookingType: 'lpg_gas' | 'electric_induction' | 'solid_biomass' | 'mixed';
  sweepingMethod: 'dry_broom' | 'wet_mop' | 'vacuum';
  usesIncenseOrDhoop: boolean;
  indoorSmoking: boolean;
}

export interface HouseholdProfile {
  id: string;
  householdName: string;
  isDemo: boolean;
  location: CityLocation;
  members: FamilyMember[];
  resources: HouseholdResources;
  completedIndoorChecklistIds: string[];
  updatedAt: string;
}

export interface TimelineItem {
  activityId: string;
  memberId: string;
  memberName: string;
  title: string;
  category: ActivityCategory;
  flexibility: Flexibility;
  originalHour: number;
  recommendedHour: number;
  durationMinutes: number;
  isOutdoorOriginal: boolean;
  isOutdoorRecommended: boolean;
  indoorAlternativeUsed: boolean;
  indoorAlternativeText?: string;
  conditionsSummary: string;
  pm25AtWindow: number | null;
  usAqiAtWindow: number | null;
  suggestedAction: string;
  reason: string;
  precaution: string;
  precautionTier: PrecautionTier;
  confidenceLabel: 'High' | 'Moderate' | 'Low (Incomplete Data)';
  dataLimitation: string;
  originalExposureProxyUgHr: number | null;
  recommendedExposureProxyUgHr: number | null;
}

export interface MemberPassport {
  memberId: string;
  memberName: string;
  role: string;
  ageGroup: AgeGroup;
  precautionTier: PrecautionTier;
  precautionLabel: string;
  urgentCareTriggered: boolean;
  urgentCareMessage?: string;
  todayOutlook: string;
  sensitivityFactors: string[];
  recommendedActivities: string[];
  activitiesToReconsider: string[];
  suggestedTimeWindows: string[];
  indoorAlternatives: string[];
  reasonsSummary: string;
  forecastUncertainty: string;
  timeline: TimelineItem[];
  totalOriginalExposureProxyUgHr: number | null;
  totalRecommendedExposureProxyUgHr: number | null;
}

export interface CoordinatedTripSuggestion {
  id: string;
  title: string;
  involvedMemberNames: string[];
  originalTripsSummary: string;
  coordinatedPlanSummary: string;
  recommendedHour: number;
  avoidedSoloKm: number;
  tradeOff: string;
}

export interface ConflictSolverResult {
  originalTimelineSummary: Array<{
    memberId: string;
    memberName: string;
    activityTitle: string;
    hour: number;
    mode: string;
    exposureProxyUgHr: number | null;
  }>;
  coordinatedTimelineSummary: Array<{
    memberId: string;
    memberName: string;
    activityTitle: string;
    originalHour: number;
    coordinatedHour: number;
    mode: string;
    changeReason: string;
    exposureProxyUgHr: number | null;
  }>;
  combinedTrips: CoordinatedTripSuggestion[];
  totalAvoidedKm: number;
  totalOriginalExposureProxyUgHr: number | null;
  totalCoordinatedExposureProxyUgHr: number | null;
  practicalBenefits: string[];
  tradeOffs: string[];
}

export interface PlanRepairChange {
  id: string;
  memberId: string;
  memberName: string;
  activityTitle: string;
  previousHour: number;
  previousAction: string;
  updatedHour: number;
  updatedAction: string;
  whatChanged: string;
  pm25Delta: number | null;
  suggestedAlternative: string;
  severity: 'notice' | 'important' | 'urgent';
}

export interface PlanRepairReport {
  hasChanges: boolean;
  detectedAt: string;
  summary: string;
  affectedMemberNames: string[];
  changes: PlanRepairChange[];
  notificationLimitation: string;
}

export interface IndoorRecommendation {
  id: string;
  tier: 'free' | 'low_cost' | 'optional_purchase';
  title: string;
  action: string;
  reason: string;
  safetyNote?: string;
}

export interface IndoorChecklistItem {
  id: string;
  label: string;
  tier: 'free' | 'low_cost' | 'optional_purchase';
  timingHint: string;
}

export interface IndoorAirPlan {
  ventilationWindowAdvice: string;
  safeToOpenWindowsNow: boolean;
  indoorMeasurementNote: string;
  combustionSafetyWarning?: string;
  recommendations: IndoorRecommendation[];
  dailyChecklist: IndoorChecklistItem[];
}

export interface GreenImpactResult {
  weeklyBaselineCarKm: number;
  weeklyOptimizedCarKm: number;
  weeklyCo2SavedKg: number;
  weeklyLocalPmExhaustSavedG: number;
  weeklyLocalNoxSavedG: number;
  activeTravelBlockedBySmog: boolean;
  safetyTradeOffNote: string;
  methodologyNote: string;
  actions: Array<{
    id: string;
    title: string;
    co2SavedKgPerWeek: number;
    localExhaustNote: string;
    exposureSafetyStatus: 'safe_now' | 'use_transit_or_carpool_instead';
  }>;
}

export interface MonthlyPreparednessEntry {
  monthIndex: number; // 0-11
  monthName: string;
  seasonTag: string;
  typicalLevel: 'lower' | 'moderate' | 'elevated' | 'severe';
  medianPm25UgM3: number | null;
  p90Pm25UgM3: number | null;
  dataBasis: 'historical_modeled_cams' | 'regional_climatology_guidance';
  keyDrivers: string;
  uncertaintyNote: string;
  preparationChecklist: string[];
}

export interface SeasonalOutlookResult {
  cityName: string;
  regionLabel: string;
  currentObservationSummary: string;
  shortTermForecastSummary: string;
  historicalPatternSummary: string;
  cropBurningContextNote: string;
  calendar: MonthlyPreparednessEntry[];
  sourceNote: string;
}

export interface AssistantStructuredReply {
  language: Language;
  usedGemini: boolean;
  modelName?: string;
  summary: string;
  actionSteps: string[];
  precautionNote: string;
  groundingNote: string;
  fallbackReason?: string;
}
