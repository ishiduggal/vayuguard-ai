import { z } from 'zod';
import { buildOfflineFallbackEnvironment, PRESET_INDIAN_CITIES } from '../src/shared/presets.js';
import type { CityLocation, EnvironmentBundle, HourlyEnvironmentPoint } from '../src/shared/types.js';
import type { MonthlyHistoricalStats } from '../src/engine/seasonalOutlook.js';

const OpenMeteoAqSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      pm10: z.number().nullable().optional(),
      pm2_5: z.number().nullable().optional(),
      carbon_monoxide: z.number().nullable().optional(),
      nitrogen_dioxide: z.number().nullable().optional(),
      sulphur_dioxide: z.number().nullable().optional(),
      ozone: z.number().nullable().optional(),
      dust: z.number().nullable().optional(),
      us_aqi: z.number().nullable().optional(),
      european_aqi: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(z.string()),
    pm10: z.array(z.number().nullable()).optional(),
    pm2_5: z.array(z.number().nullable()).optional(),
    carbon_monoxide: z.array(z.number().nullable()).optional(),
    nitrogen_dioxide: z.array(z.number().nullable()).optional(),
    sulphur_dioxide: z.array(z.number().nullable()).optional(),
    ozone: z.array(z.number().nullable()).optional(),
    dust: z.array(z.number().nullable()).optional(),
    us_aqi: z.array(z.number().nullable()).optional(),
    european_aqi: z.array(z.number().nullable()).optional(),
  }),
});

const OpenMeteoWeatherSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      temperature_2m: z.number().nullable().optional(),
      relative_humidity_2m: z.number().nullable().optional(),
      precipitation: z.number().nullable().optional(),
      wind_speed_10m: z.number().nullable().optional(),
      wind_direction_10m: z.number().nullable().optional(),
      weather_code: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()).optional(),
    relative_humidity_2m: z.array(z.number().nullable()).optional(),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    precipitation: z.array(z.number().nullable()).optional(),
    visibility: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()).optional(),
    wind_direction_10m: z.array(z.number().nullable()).optional(),
    boundary_layer_height: z.array(z.number().nullable()).optional(),
    weather_code: z.array(z.number().nullable()).optional(),
  }),
});

const GeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

interface CacheEntry<T> {
  value: T;
  fetchedAtMs: number;
}

const envCache = new Map<string, CacheEntry<EnvironmentBundle>>();
const seasonalCache = new Map<string, CacheEntry<MonthlyHistoricalStats[]>>();

const FRESH_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_MAX_MS = 6 * 60 * 60 * 1000; // 6 hours
const SEASONAL_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function clearProviderCaches(): void {
  envCache.clear();
  seasonalCache.clear();
}

export async function fetchJsonWithRetry(
  url: string,
  timeoutMs = 8000,
  retries = 2,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

function cacheKeyForCoords(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function searchCities(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<CityLocation[]> {
  const trimmed = query.trim();
  const presetMatches = PRESET_INDIAN_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(trimmed.toLowerCase()) ||
      c.state.toLowerCase().includes(trimmed.toLowerCase()),
  );
  if (!trimmed) return PRESET_INDIAN_CITIES;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`;
    const raw = await fetchJsonWithRetry(url, 6000, 1, fetcher);
    const parsed = GeocodeSchema.parse(raw);
    const apiCities: CityLocation[] = (parsed.results ?? []).map((r) => ({
      id: `geo-${r.id}`,
      name: r.name,
      state: r.admin1 ?? 'Region',
      country: r.country ?? 'India',
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? 'Asia/Kolkata',
      detectionMethod: 'search',
      confirmed: true,
    }));

    // Merge presets that match at top without duplicates
    const seen = new Set(presetMatches.map((p) => p.name.toLowerCase()));
    return [...presetMatches, ...apiCities.filter((c) => !seen.has(c.name.toLowerCase()))].slice(0, 8);
  } catch {
    return presetMatches;
  }
}

function parseHourFromIso(iso: string): number {
  const match = /T(\d{2}):/.exec(iso);
  return match ? Number(match[1]) : 0;
}

export async function fetchEnvironmentForLocation(
  location: CityLocation,
  options?: { forceRefresh?: boolean; fetcher?: typeof fetch },
): Promise<EnvironmentBundle> {
  const fetcher = options?.fetcher ?? fetch;
  const key = cacheKeyForCoords(location.latitude, location.longitude) + location.timezone;
  const nowMs = Date.now();
  const cached = envCache.get(key);

  if (!options?.forceRefresh && cached && nowMs - cached.fetchedAtMs < FRESH_TTL_MS) {
    return { ...cached.value, location, isStale: false };
  }

  const tz = encodeURIComponent(location.timezone || 'Asia/Kolkata');
  const aqUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,us_aqi,european_aqi` +
    `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,us_aqi,european_aqi` +
    `&timezone=${tz}&forecast_days=2`;

  const wxUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,visibility,wind_speed_10m,wind_direction_10m,boundary_layer_height,weather_code` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code` +
    `&timezone=${tz}&forecast_days=2`;

  try {
    const [rawAq, rawWx] = await Promise.all([
      fetchJsonWithRetry(aqUrl, 8000, 2, fetcher),
      fetchJsonWithRetry(wxUrl, 8000, 2, fetcher),
    ]);

    const aq = OpenMeteoAqSchema.parse(rawAq);
    const wx = OpenMeteoWeatherSchema.parse(rawWx);

    // Map next 24 hours starting at local midnight of the current date in response
    const hourlyPoints: HourlyEnvironmentPoint[] = [];
    const wxByTime = new Map<string, number>();
    wx.hourly.time.forEach((t, i) => wxByTime.set(t, i));

    // Take first 24 hours (today 00:00..23:00 in location's local timezone)
    const count = Math.min(24, aq.hourly.time.length);
    if (count === 0) throw new Error('Empty hourly forecast');
    for (let i = 0; i < count; i++) {
      const time = aq.hourly.time[i];
      const wIdx = wxByTime.get(time) ?? -1;
      hourlyPoints.push({
        time,
        hour: parseHourFromIso(time),
        pm25: aq.hourly.pm2_5?.[i] ?? null,
        pm10: aq.hourly.pm10?.[i] ?? null,
        no2: aq.hourly.nitrogen_dioxide?.[i] ?? null,
        so2: aq.hourly.sulphur_dioxide?.[i] ?? null,
        co: aq.hourly.carbon_monoxide?.[i] ?? null,
        o3: aq.hourly.ozone?.[i] ?? null,
        dust: aq.hourly.dust?.[i] ?? null,
        usAqi: aq.hourly.us_aqi?.[i] ?? null,
        europeanAqi: aq.hourly.european_aqi?.[i] ?? null,
        temperatureC: wx.hourly.temperature_2m?.[wIdx] ?? null,
        humidityPct: wx.hourly.relative_humidity_2m?.[wIdx] ?? null,
        windSpeedKmh: wx.hourly.wind_speed_10m?.[wIdx] ?? null,
        windDirectionDeg: wx.hourly.wind_direction_10m?.[wIdx] ?? null,
        precipitationMm: wx.hourly.precipitation?.[wIdx] ?? null,
        precipitationProbPct: wx.hourly.precipitation_probability?.[wIdx] ?? null,
        visibilityM: wx.hourly.visibility?.[wIdx] ?? null,
        boundaryLayerHeightM: wx.hourly.boundary_layer_height?.[wIdx] ?? null,
        weatherCode: wx.hourly.weather_code?.[wIdx] ?? null,
      });
    }

    const currentTime = aq.current?.time ?? wx.current?.time ?? hourlyPoints[0]?.time ?? new Date().toISOString();
    const currentHour = parseHourFromIso(currentTime);
    const matchingHourPoint = hourlyPoints.find((h) => h.hour === currentHour) ?? hourlyPoints[0];

    const current: HourlyEnvironmentPoint = {
      time: currentTime,
      hour: currentHour,
      pm25: aq.current?.pm2_5 ?? matchingHourPoint?.pm25 ?? null,
      pm10: aq.current?.pm10 ?? matchingHourPoint?.pm10 ?? null,
      no2: aq.current?.nitrogen_dioxide ?? matchingHourPoint?.no2 ?? null,
      so2: aq.current?.sulphur_dioxide ?? matchingHourPoint?.so2 ?? null,
      co: aq.current?.carbon_monoxide ?? matchingHourPoint?.co ?? null,
      o3: aq.current?.ozone ?? matchingHourPoint?.o3 ?? null,
      dust: aq.current?.dust ?? matchingHourPoint?.dust ?? null,
      usAqi: aq.current?.us_aqi ?? matchingHourPoint?.usAqi ?? null,
      europeanAqi: aq.current?.european_aqi ?? matchingHourPoint?.europeanAqi ?? null,
      temperatureC: wx.current?.temperature_2m ?? matchingHourPoint?.temperatureC ?? null,
      humidityPct: wx.current?.relative_humidity_2m ?? matchingHourPoint?.humidityPct ?? null,
      windSpeedKmh: wx.current?.wind_speed_10m ?? matchingHourPoint?.windSpeedKmh ?? null,
      windDirectionDeg: wx.current?.wind_direction_10m ?? matchingHourPoint?.windDirectionDeg ?? null,
      precipitationMm: wx.current?.precipitation ?? matchingHourPoint?.precipitationMm ?? null,
      precipitationProbPct: matchingHourPoint?.precipitationProbPct ?? null,
      visibilityM: matchingHourPoint?.visibilityM ?? null,
      boundaryLayerHeightM: matchingHourPoint?.boundaryLayerHeightM ?? null,
      weatherCode: wx.current?.weather_code ?? matchingHourPoint?.weatherCode ?? null,
    };

    const missingFields: string[] = [];
    if (current.pm25 === null) missingFields.push('PM2.5');
    if (current.pm10 === null) missingFields.push('PM10');
    if (current.usAqi === null) missingFields.push('US AQI');
    if (current.boundaryLayerHeightM === null) missingFields.push('Boundary Layer Height');
    if (current.visibilityM === null) missingFields.push('Visibility');

    const bundle: EnvironmentBundle = {
      location,
      source: 'Open-Meteo Air Quality (CAMS) & Weather Forecast API',
      dataKind: 'modeled_forecast',
      aqiStandard: 'US EPA AQI (Open-Meteo us_aqi) + European AQI',
      fetchedAt: new Date(nowMs).toISOString(),
      forecastHorizonHours: hourlyPoints.length,
      isStale: false,
      missingFields,
      current,
      hourly: hourlyPoints,
    };

    envCache.set(key, { value: bundle, fetchedAtMs: nowMs });
    return bundle;
  } catch (err) {
    if (cached && nowMs - cached.fetchedAtMs < STALE_MAX_MS) {
      return {
        ...cached.value,
        location,
        isStale: true,
        staleReason: `Live refresh failed (${err instanceof Error ? err.message : 'network error'}); showing cached forecast from ${cached.value.fetchedAt}.`,
      };
    }
    return buildOfflineFallbackEnvironment(location);
  }
}

export async function fetchHistoricalMonthlyStats(
  location: CityLocation,
  fetcher: typeof fetch = fetch,
): Promise<MonthlyHistoricalStats[]> {
  const key = cacheKeyForCoords(location.latitude, location.longitude) + location.timezone;
  const nowMs = Date.now();
  const cached = seasonalCache.get(key);
  if (cached && nowMs - cached.fetchedAtMs < SEASONAL_TTL_MS) {
    return cached.value;
  }

  try {
    const endDate = new Date(nowMs - 2 * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - 364 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}` +
      `&hourly=pm2_5&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}&timezone=${encodeURIComponent(location.timezone || 'Asia/Kolkata')}`;

    const raw = await fetchJsonWithRetry(url, 10000, 1, fetcher);
    const parsed = OpenMeteoAqSchema.parse(raw);
    const buckets: number[][] = Array.from({ length: 12 }, () => []);

    parsed.hourly.time.forEach((iso, idx) => {
      const val = parsed.hourly.pm2_5?.[idx];
      if (val === null || val === undefined || !Number.isFinite(val)) return;
      const month = Number(iso.slice(5, 7)) - 1;
      if (month >= 0 && month < 12) {
        buckets[month].push(val);
      }
    });

    const stats: MonthlyHistoricalStats[] = [];
    buckets.forEach((arr, monthIndex) => {
      if (arr.length < 24) return;
      arr.sort((a, b) => a - b);
      const medianPm25 = arr[Math.floor(arr.length * 0.5)];
      const p90Pm25 = arr[Math.floor(arr.length * 0.9)];
      stats.push({ monthIndex, medianPm25, p90Pm25 });
    });

    if (stats.length > 0) {
      seasonalCache.set(key, { value: stats, fetchedAtMs: nowMs });
    }
    return stats;
  } catch {
    return cached?.value ?? [];
  }
}
