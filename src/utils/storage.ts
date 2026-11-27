import { HouseholdSchema } from '../shared/validation.js';
import { PRESET_INDIAN_CITIES } from '../shared/presets.js';
import type { CityLocation, HouseholdProfile } from '../shared/types.js';

const STORAGE_KEY = 'vayuguard_household_v1';

export function loadStoredHousehold(): HouseholdProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = HouseholdSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveHouseholdToStorage(profile: HouseholdProfile): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...profile,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function clearStoredHousehold(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function createEmptyHousehold(location?: CityLocation): HouseholdProfile {
  return {
    id: `household-${Date.now()}`,
    householdName: 'My Family',
    isDemo: false,
    location: location ?? PRESET_INDIAN_CITIES[0],
    members: [],
    resources: {
      hasAirPurifier: false,
      hasAirConditioning: false,
      hasExhaustFan: true,
      hasIndoorSensor: false,
      measuredIndoorPm25: null,
      hasPublicTransitAccess: true,
      limitedBudget: true,
      cookingType: 'lpg_gas',
      sweepingMethod: 'wet_mop',
      usesIncenseOrDhoop: false,
      indoorSmoking: false,
    },
    completedIndoorChecklistIds: [],
    updatedAt: new Date().toISOString(),
  };
}
