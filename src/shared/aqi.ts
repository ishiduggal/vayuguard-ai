import type { PrecautionTier } from './types.js';

export interface AqiCategoryInfo {
  label: string;
  tier: PrecautionTier;
  description: string;
}

/**
 * Maps US EPA AQI (as returned by Open-Meteo `us_aqi`) to an accessible non-clinical tier.
 */
export function classifyUsAqi(usAqi: number | null): AqiCategoryInfo {
  if (usAqi === null || Number.isNaN(usAqi)) {
    return {
      label: 'Unavailable',
      tier: 'moderate',
      description: 'US AQI reading unavailable; check local official advice and follow conservative precautions.',
    };
  }
  if (usAqi <= 50) {
    return {
      label: 'Good (US AQI 0–50)',
      tier: 'low',
      description: 'Generally low particulate levels for most household activities.',
    };
  }
  if (usAqi <= 100) {
    return {
      label: 'Moderate (US AQI 51–100)',
      tier: 'moderate',
      description: 'Sensitive family members may notice mild irritation during prolonged outdoor exertion.',
    };
  }
  if (usAqi <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups (US AQI 101–150)',
      tier: 'high',
      description: 'Children, older adults, and people with asthma should shorten or move vigorous outdoor activity indoors.',
    };
  }
  if (usAqi <= 200) {
    return {
      label: 'Unhealthy (US AQI 151–200)',
      tier: 'high',
      description: 'Reduce outdoor exertion for everyone; move flexible routines indoors.',
    };
  }
  if (usAqi <= 300) {
    return {
      label: 'Very Unhealthy (US AQI 201–300)',
      tier: 'stay_indoors',
      description: 'Avoid avoidable outdoor exertion; keep sensitive members indoors with cleaner indoor air.',
    };
  }
  return {
    label: 'Hazardous (US AQI 301+)',
    tier: 'stay_indoors',
    description: 'Minimize all outdoor exposure and wear a well-fitted N95/KN95 respirator for essential travel.',
  };
}

/**
 * Illustrative Indian CPCB National AQI (NAQI) PM2.5 breakpoint mapping.
 *
 * IMPORTANT SCIENTIFIC NOTE:
 * Official CPCB NAQI requires 24-hour running averages of at least 3 pollutants (including PM2.5 or PM10)
 * from validated monitoring stations. Applying these breakpoints to a 1-hour modeled forecast concentration
 * yields an *illustrative PM2.5 sub-index*, NOT an official CPCB NAQI station value.
 */
const CPCB_PM25_BREAKPOINTS: Array<{
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: string;
}> = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 30.001, cHigh: 60, iLow: 51, iHigh: 100, category: 'Satisfactory' },
  { cLow: 60.001, cHigh: 90, iLow: 101, iHigh: 200, category: 'Moderate' },
  { cLow: 90.001, cHigh: 120, iLow: 201, iHigh: 300, category: 'Poor' },
  { cLow: 120.001, cHigh: 250, iLow: 301, iHigh: 400, category: 'Very Poor' },
  { cLow: 250.001, cHigh: 500, iLow: 401, iHigh: 500, category: 'Severe' },
];

export interface IllustrativeCpcbSubIndex {
  subIndex: number;
  category: string;
  isOfficialStationNaqi: false;
  caveat: string;
}

export function computeIllustrativeCpcbPm25SubIndex(
  pm25UgM3: number | null,
): IllustrativeCpcbSubIndex | null {
  if (pm25UgM3 === null || !Number.isFinite(pm25UgM3) || pm25UgM3 < 0) {
    return null;
  }
  const capped = Math.min(pm25UgM3, 500);
  const bp =
    CPCB_PM25_BREAKPOINTS.find((b) => capped <= b.cHigh) ??
    CPCB_PM25_BREAKPOINTS[CPCB_PM25_BREAKPOINTS.length - 1];

  const ratio = (Math.max(0, capped - bp.cLow)) / Math.max(1e-6, bp.cHigh - bp.cLow);
  const subIndex = Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));

  return {
    subIndex: Math.min(500, Math.max(0, subIndex)),
    category: bp.category,
    isOfficialStationNaqi: false,
    caveat:
      'Illustrative hourly modeled PM2.5 CPCB-breakpoint sub-index only (official CPCB NAQI uses 24-hour station averages across >=3 pollutants).',
  };
}

export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return '12:00 AM';
  if (normalized === 12) return '12:00 PM';
  if (normalized < 12) return `${normalized}:00 AM`;
  return `${normalized - 12}:00 PM`;
}

export function windCompassDirection(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return 'N/A';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
