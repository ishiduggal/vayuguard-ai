import { HouseholdSchema, EnvironmentSchema } from '../src/shared/validation.js';
import { buildMemberPassport, solveHouseholdConflicts } from '../src/engine/index.js';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { PRESET_INDIAN_CITIES } from '../src/shared/presets.js';
import type { CityLocation } from '../src/shared/types.js';
import { buildSeasonalOutlook } from '../src/engine/seasonalOutlook.js';
import {
  fetchEnvironmentForLocation,
  fetchHistoricalMonthlyStats,
  searchCities,
} from './envProvider.js';
import { generateAssistantReply } from './geminiService.js';

const LocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().min(1).max(100).default('Patiala'),
  state: z.string().max(100).default('Punjab'),
  country: z.string().max(100).default('India'),
  timezone: z.string().max(60).refine(v => { try { new Intl.DateTimeFormat('en', {timeZone:v}); return true; } catch { return false; } }).default('Asia/Kolkata'),
  force: z.string().optional(),
});

const AssistantBodySchema = z.object({
  question: z.string().min(1).max(600),
  language: z.enum(['en', 'hi', 'pa', 'pa_roman']).default('en'),
  household: HouseholdSchema,
  environment: EnvironmentSchema,
  passports: z.array(z.record(z.string(), z.unknown())),
  conflictResult: z.record(z.string(), z.unknown()),
  planRepair: z.record(z.string(), z.unknown()).nullable().optional(),
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  let assistantActive = 0;
  let assistantCalls = 0;
  let assistantWindow = Date.now();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'VayuGuard AI',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/geocode', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const results = await searchCities(q);
    res.json({ results });
  });

  app.get('/api/environment', async (req, res) => {
    const fallbackCity = PRESET_INDIAN_CITIES[0];
    const parsed = LocationQuerySchema.safeParse({
      lat: req.query.lat ?? fallbackCity.latitude,
      lon: req.query.lon ?? fallbackCity.longitude,
      name: req.query.name ?? fallbackCity.name,
      state: req.query.state ?? fallbackCity.state,
      country: req.query.country ?? fallbackCity.country,
      timezone: req.query.timezone ?? fallbackCity.timezone,
      force: req.query.force,
    });

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid coordinates or location query', details: parsed.error.flatten() });
      return;
    }

    const location: CityLocation = {
      id: `loc-${parsed.data.lat.toFixed(2)}-${parsed.data.lon.toFixed(2)}`,
      name: parsed.data.name,
      state: parsed.data.state,
      country: parsed.data.country,
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      timezone: parsed.data.timezone,
      detectionMethod: 'manual',
      confirmed: true,
    };

    const bundle = await fetchEnvironmentForLocation(location, {
      forceRefresh: parsed.data.force === '1' || parsed.data.force === 'true',
    });
    res.json(bundle);
  });

  app.get('/api/seasonal', async (req, res) => {
    const fallbackCity = PRESET_INDIAN_CITIES[0];
    const parsed = LocationQuerySchema.safeParse({
      lat: req.query.lat ?? fallbackCity.latitude,
      lon: req.query.lon ?? fallbackCity.longitude,
      name: req.query.name ?? fallbackCity.name,
      state: req.query.state ?? fallbackCity.state,
      country: req.query.country ?? fallbackCity.country,
      timezone: req.query.timezone ?? fallbackCity.timezone,
    });

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid location parameters' });
      return;
    }

    const location: CityLocation = {
      id: `loc-${parsed.data.lat.toFixed(2)}-${parsed.data.lon.toFixed(2)}`,
      name: parsed.data.name,
      state: parsed.data.state,
      country: parsed.data.country,
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      timezone: parsed.data.timezone,
      detectionMethod: 'manual',
      confirmed: true,
    };

    const [env, hist] = await Promise.all([
      fetchEnvironmentForLocation(location),
      fetchHistoricalMonthlyStats(location),
    ]);

    const outlook = buildSeasonalOutlook(env, hist);
    res.json(outlook);
  });

  app.post('/api/assistant', async (req, res) => {
    const parsed = AssistantBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid assistant request payload', details: parsed.error.flatten() });
      return;
    }

    if (Date.now() - assistantWindow > 60_000) { assistantWindow = Date.now(); assistantCalls = 0; }
    if (assistantActive >= 2 || assistantCalls >= 20) {
      res.status(429).json({ error: 'Assistant is busy. Please retry in a minute.' }); return;
    }
    assistantActive++; assistantCalls++;
    try {
      const { household, environment } = parsed.data;
      const passports = household.members.map(m => buildMemberPassport(m, environment, household.resources));
      const reply = await generateAssistantReply({ ...parsed.data, passports,
        conflictResult: solveHouseholdConflicts(household, passports, environment), planRepair: null });
      res.json(reply);
    } finally { assistantActive--; }
  });

  // Production static bundle serving (built into dist/client)
  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('/{*path}', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  return app;
}
