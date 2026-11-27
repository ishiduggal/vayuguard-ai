import { z } from 'zod';
const text = z.string().max(600);
const hour = z.number().int().min(0).max(23);
const answer = z.enum(['yes', 'no', 'not_sure', 'prefer_not_to_answer']);
export const LocationSchema = z.object({ id: text, name: text, state: text, country: text, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', {timeZone:v}); return true; } catch { return false; } }), detectionMethod: z.enum(['preset','search','geolocation','manual']), confirmed: z.boolean() });
export const HouseholdSchema = z.object({
  id: text, householdName: text, isDemo: z.boolean(), location: LocationSchema,
  members: z.array(z.object({ id: text, name: text, role: text, ageGroup: z.enum(['infant_toddler','child','teen_student','adult','older_adult']), wakeHour: hour, sleepHour: hour, preferredLanguage: z.enum(['en','hi','pa','pa_roman']),
    sensitivities: z.object({ diagnosedAsthma: answer, dustOrSeasonalAllergy: answer, smokeOrCropBurningSensitivity: answer, otherRespiratoryCondition: answer, coldAirSensitivity: answer, frequentIrritationDuringSmog: answer, clinicianPrecautionsNote: text, urgentSymptomsReported: z.boolean() }),
    activities: z.array(z.object({ id: text, title: text, category: z.enum(['morning_walk','school','office_commute','outdoor_work','exercise','grocery','cooking','ventilation','outdoor_play','custom']), flexibility: z.enum(['fixed','flexible']), preferredStartHour: hour, durationMinutes: z.number().int().min(1).max(1440), intensity: z.enum(['low','moderate','vigorous']), isOutdoor: z.boolean(), transportMode: z.enum(['car','two_wheeler','public_transit','carpool','walk_cycle','remote']).optional(), tripDistanceKm: z.number().min(0).max(1000).optional(), notes: text.optional() })).max(40)
  })).min(1).max(20),
  resources: z.object({ hasAirPurifier: z.boolean(), hasAirConditioning: z.boolean(), hasExhaustFan: z.boolean(), hasIndoorSensor: z.boolean(), measuredIndoorPm25: z.number().min(0).max(5000).nullable(), hasPublicTransitAccess: z.boolean(), limitedBudget: z.boolean(), cookingType: z.enum(['lpg_gas','electric_induction','solid_biomass','mixed']), sweepingMethod: z.enum(['dry_broom','wet_mop','vacuum']), usesIncenseOrDhoop: z.boolean(), indoorSmoking: z.boolean() }),
  completedIndoorChecklistIds: z.array(text).max(100), updatedAt: z.string()
});
const measurement = z.number().finite().nullable();
const PointSchema = z.object({time:z.string(),hour, pm25:measurement,pm10:measurement,no2:measurement,so2:measurement,co:measurement,o3:measurement,dust:measurement,usAqi:measurement,europeanAqi:measurement,temperatureC:measurement,humidityPct:measurement,windSpeedKmh:measurement,windDirectionDeg:measurement,precipitationMm:measurement,precipitationProbPct:measurement,visibilityM:measurement,boundaryLayerHeightM:measurement,weatherCode:measurement});
export const EnvironmentSchema = z.object({location:LocationSchema,source:text,dataKind:z.enum(['modeled_forecast','historical_modeled','simulated_scenario','fallback_offline']),aqiStandard:text,fetchedAt:z.string(),forecastHorizonHours:z.number(),isStale:z.boolean(),staleReason:text.optional(),simulationLabel:text.optional(),missingFields:z.array(text),current:PointSchema,hourly:z.array(PointSchema).min(1).max(48)});
