import { EventEmitter } from 'node:events';
import type { Express } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import {
  clearProviderCaches,
  fetchEnvironmentForLocation,
  searchCities,
} from '../server/envProvider.js';
import { generateAssistantReply } from '../server/geminiService.js';
import {
  buildOfflineFallbackEnvironment,
  createPatialaDemoHousehold,
  PRESET_INDIAN_CITIES,
} from '../src/shared/presets.js';
import { buildMemberPassport, solveHouseholdConflicts } from '../src/engine/index.js';

/**
 * In-memory Express dispatcher so backend integration tests run reliably even in
 * socket-restricted sandboxes without binding TCP ports.
 */
async function invokeApp(
  app: Express,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter() as EventEmitter & {
      method: string;
      url: string;
      originalUrl: string;
      headers: Record<string, string>;
      body?: unknown;
      socket: Record<string, unknown>;
    };
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { 'content-type': 'application/json' };
    req.body = body;
    req.socket = {};

    const headers: Record<string, string> = {};
    const res = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      getHeader: (k: string) => string | undefined;
      removeHeader: (k: string) => void;
      status: (code: number) => typeof res;
      json: (data: unknown) => void;
      end: (chunk?: string) => void;
    };
    res.statusCode = 200;
    res.setHeader = (k, v) => {
      headers[k.toLowerCase()] = String(v);
    };
    res.getHeader = (k) => headers[k.toLowerCase()];
    res.removeHeader = (k) => {
      delete headers[k.toLowerCase()];
    };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: unknown) => {
      resolve({ status: res.statusCode, body: data as Record<string, unknown> });
    };
    res.end = (chunk?: string) => {
      let parsed: Record<string, unknown> = {};
      if (chunk) {
        try {
          parsed = JSON.parse(chunk) as Record<string, unknown>;
        } catch {
          parsed = { raw: chunk };
        }
      }
      resolve({ status: res.statusCode, body: parsed });
    };

    try {
      (app as unknown as (rq: unknown, rs: unknown, next: (err?: unknown) => void) => void)(
        req,
        res,
        (err?: unknown) => {
          if (err) reject(err);
          else resolve({ status: res.statusCode, body: {} });
        },
      );
      if (body !== undefined) {
        queueMicrotask(() => {
          req.emit('data', Buffer.from(JSON.stringify(body)));
          req.emit('end');
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

describe('Backend API, Resilience, and Gemini Fallback', () => {
  beforeEach(() => {
    clearProviderCaches();
    delete process.env.GEMINI_API_KEY;
  });

  it('serves /api/health and validates /api/environment bad coordinates cleanly', async () => {
    const app = createApp();
    const health = await invokeApp(app, 'GET', '/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const badEnv = await invokeApp(app, 'GET', '/api/environment?lat=999&lon=76');
    expect(badEnv.status).toBe(400);
  });

  it('handles malformed upstream Open-Meteo responses and network failures gracefully with fallback', async () => {
    const brokenFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'corrupt-payload' }),
    }) as unknown as typeof fetch;

    const env = await fetchEnvironmentForLocation(PRESET_INDIAN_CITIES[0], {
      forceRefresh: true,
      fetcher: brokenFetcher,
    });

    expect(env.dataKind).toBe('fallback_offline');
    expect(env.isStale).toBe(true);
    expect(env.hourly).toHaveLength(24);
  });

  it('returns stale cached forecast when a later refresh fails', async () => {
    const validAq = {
      current: { time: '2026-11-27T14:00', pm2_5: 80, pm10: 100, us_aqi: 164 },
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `2026-11-27T${String(i).padStart(2, '0')}:00`),
        pm2_5: Array.from({ length: 24 }, () => 80),
        pm10: Array.from({ length: 24 }, () => 100),
        us_aqi: Array.from({ length: 24 }, () => 164),
      },
    };
    const validWx = {
      current: { time: '2026-11-27T14:00', temperature_2m: 20, wind_speed_10m: 6 },
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `2026-11-27T${String(i).padStart(2, '0')}:00`),
        temperature_2m: Array.from({ length: 24 }, () => 20),
        wind_speed_10m: Array.from({ length: 24 }, () => 6),
        boundary_layer_height: Array.from({ length: 24 }, () => 450),
      },
    };

    let callCount = 0;
    const flakyFetcher = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      if (callCount <= 2) {
        const isAq = String(url).includes('air-quality');
        return new Response(JSON.stringify(isAq ? validAq : validWx), { status: 200 });
      }
      throw new Error('Upstream timeout');
    }) as unknown as typeof fetch;

    const fresh = await fetchEnvironmentForLocation(PRESET_INDIAN_CITIES[0], {
      forceRefresh: true,
      fetcher: flakyFetcher,
    });
    expect(fresh.dataKind).toBe('modeled_forecast');
    expect(fresh.isStale).toBe(false);

    const stale = await fetchEnvironmentForLocation(PRESET_INDIAN_CITIES[0], {
      forceRefresh: true,
      fetcher: flakyFetcher,
    });
    expect(stale.dataKind).toBe('modeled_forecast');
    expect(stale.isStale).toBe(true);
    expect(stale.staleReason).toContain('Upstream timeout');
  });

  it('falls back to preset Indian cities if geocode API fails', async () => {
    const failingFetcher = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const cities = await searchCities('Patiala', failingFetcher);
    expect(cities.some((c) => c.name === 'Patiala')).toBe(true);
  });

  it('serves deterministic multilingual assistant replies when GEMINI_API_KEY is unset and validates /api/assistant', async () => {
    const household = createPatialaDemoHousehold();
    const env = buildOfflineFallbackEnvironment(household.location);
    const passports = household.members.map((m) =>
      buildMemberPassport(m, env, household.resources),
    );
    const conflictResult = solveHouseholdConflicts(household, passports, env);

    for (const lang of ['en', 'hi', 'pa', 'pa_roman'] as const) {
      const reply = await generateAssistantReply({
        question: 'We cannot afford an air purifier. What can we do?',
        language: lang,
        household,
        environment: env,
        passports,
        conflictResult,
        planRepair: null,
      });
      expect(reply.usedGemini).toBe(false);
      expect(reply.language).toBe(lang);
      expect(reply.actionSteps.length).toBeGreaterThan(0);
    }

    const app = createApp();
    const res = await invokeApp(app, 'POST', '/api/assistant', {
      question: 'My father wants to go for a walk. When would pollution exposure likely be lower?',
      language: 'en',
      household,
      environment: env,
      passports,
      conflictResult,
    });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();

    const invalid = await invokeApp(app, 'POST', '/api/assistant', { question: '' });
    expect(invalid.status).toBe(400);
  });
});
