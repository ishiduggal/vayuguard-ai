import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { buildAnonymizedGroundingContext, generateAssistantReply } from '../server/geminiService.js';
import { buildOfflineFallbackEnvironment, createPatialaDemoHousehold } from '../src/shared/presets.js';
import { buildMemberPassport, solveHouseholdConflicts, buildIndoorAirPlan, calculateGreenImpact, compareForecastsAndRepair, buildSimulatedSpikeEnvironment } from '../src/engine/index.js';
import { computeIllustrativeCpcbPm25SubIndex } from '../src/shared/aqi.js';
import { loadStoredHousehold } from '../src/utils/storage.js';
function fixture(pm = 45) {
  const household = createPatialaDemoHousehold();
  const base = buildOfflineFallbackEnvironment(household.location);
  const environment = { ...base, isStale: false, dataKind: 'modeled_forecast' as const,
    hourly: base.hourly.map(h => ({...h, pm25:pm, usAqi:80, temperatureC:20, boundaryLayerHeightM:500})), current:{...base.current,pm25:pm,usAqi:80}};
  return { household, environment };
}
function payload() {
  const { household, environment } = fixture();
  const passports = household.members.map(m => buildMemberPassport(m, environment, household.resources));
  return {question:'Explain my routine', language:'en' as const, household, environment, passports, conflictResult:solveHouseholdConflicts(household,passports,environment)};
}
describe('Independent audit regression cases', () => {
  it('changes advice with sensitivity while name, age and routine remain identical', () => {
    const { household, environment } = fixture();
    const member = structuredClone(household.members[0]);
    member.activities = [member.activities[0]];
    const sensitive = buildMemberPassport(member,environment,household.resources);
    for (const key of ['diagnosedAsthma','dustOrSeasonalAllergy','smokeOrCropBurningSensitivity','otherRespiratoryCondition','coldAirSensitivity','frequentIrritationDuringSmog'] as const) member.sensitivities[key] = 'no';
    const baseline = buildMemberPassport(member,environment,household.resources);
    expect(sensitive.timeline[0].isOutdoorRecommended).toBe(false);
    expect(baseline.timeline[0].isOutdoorRecommended).toBe(true);
  });
  it('keeps flexible activities out of school and each other', () => {
    const {household,environment} = fixture(15);
    const child = household.members[3];
    child.activities.push({...child.activities[1],id:'second-play'});
    environment.hourly.forEach(h => { if(h.hour === 10) h.pm25=1; });
    const p=buildMemberPassport(child,environment,household.resources);
    const school=p.timeline.find(t=>t.category==='school')!;
    expect(school.recommendedHour).toBe(8);
    const plays=p.timeline.filter(t=>t.category==='outdoor_play');
    expect(plays.every(t=>t.recommendedHour<8 || t.recommendedHour>=14)).toBe(true);
    expect(plays[0].recommendedHour).not.toBe(plays[1].recommendedHour);
  });
  it('averages concentration over duration rather than only the first hour', () => {
    const {household,environment}=fixture(10);
    const m=household.members[0];m.activities=[{...m.activities[0],flexibility:'fixed',preferredStartHour:10,durationMinutes:120,intensity:'low'}];
    environment.hourly[11].pm25=110;
    expect(buildMemberPassport(m,environment,household.resources).timeline[0].originalExposureProxyUgHr).toBe(120);
  });
  it('respects overnight waking hours and reports a full schedule as infeasible',()=>{
    const {household,environment}=fixture(10);const m=household.members[0];
    m.wakeHour=20;m.sleepHour=6;m.activities=[m.activities[0]];
    const t=buildMemberPassport(m,environment,household.resources).timeline[0];
    expect(t.recommendedHour>=20 || t.recommendedHour<6).toBe(true);
    m.wakeHour=6;m.sleepHour=7;m.activities[0].durationMinutes=120;
    expect(buildMemberPassport(m,environment,household.resources).timeline[0].suggestedAction).toContain('No feasible');
  });
  it('does not reuse home sensor readings for open two-wheeler trips',()=>{
    const {household,environment}=fixture(100);household.resources.hasIndoorSensor=true;household.resources.measuredIndoorPm25=1;
    const t=buildMemberPassport(household.members[2],environment,household.resources).timeline.find(t=>t.category==='school')!;
    expect(t.originalExposureProxyUgHr).toBe(75);
  });
  it('does not fabricate route savings or shift fixed commitments in coordination',()=>{
    const p=payload();p.household.members[2].activities[0].preferredStartHour=8;
    const passports=p.household.members.map(m=>buildMemberPassport(m,p.environment,p.household.resources));
    const result=solveHouseholdConflicts(p.household,passports,p.environment);
    expect(result.totalAvoidedKm).toBe(0);
    for(const pass of passports) for(const t of pass.timeline.filter(t=>t.flexibility==='fixed'))
      expect(result.coordinatedTimelineSummary.find(r=>r.memberId===t.memberId && r.activityTitle===t.title)?.coordinatedHour).toBe(t.originalHour);
  });
  it('excludes urgent members from shared trips and assistant planning',async()=>{
    const p=payload();p.household.members[0].sensitivities.urgentSymptomsReported=true;
    p.passports=p.household.members.map(m=>buildMemberPassport(m,p.environment,p.household.resources));
    const result=solveHouseholdConflicts(p.household,p.passports,p.environment);
    expect(result.combinedTrips.every(t=>!t.involvedMemberNames.includes('Rajesh'))).toBe(true);
    expect((await generateAssistantReply(p)).summary).toContain('Urgent');
    expect(p.passports[0].suggestedTimeWindows[0]).toContain('paused');
  });
  it('does not recommend respirators to infants',()=>{
    const {household,environment}=fixture(200);const m=household.members[3];m.ageGroup='infant_toddler';
    expect(buildMemberPassport(m,environment,household.resources).timeline.every(t=>t.precaution.includes('Never put a mask'))).toBe(true);
  });
  it('keeps all ventilation advice consistent on severe days',()=>{
    const {household,environment}=fixture(200);const indoor=buildIndoorAirPlan(household.resources,environment);
    expect(indoor.safeToOpenWindowsNow).toBe(false);
    expect(indoor.recommendations[0].action).toBe(indoor.ventilationWindowAdvice);
    expect(indoor.dailyChecklist.find(c=>c.id==='chk-window-window')?.label).toContain('Defer');
  });
  it('does not promote outdoor activity with missing pollutants or hazardous overall AQI',()=>{
    const {household,environment}=fixture(10);
    environment.hourly.forEach(h=>h.usAqi=350);
    expect(buildMemberPassport(household.members[0],environment,household.resources).timeline.find(t=>t.flexibility==='flexible')?.isOutdoorRecommended).toBe(false);
  });
  it('returns zero vehicle savings for a household without car travel',()=>{
    const {household,environment}=fixture();household.members.forEach(m=>m.activities=[]);
    const green=calculateGreenImpact(household,solveHouseholdConflicts(household,[],environment),environment,25);
    expect(green.weeklyBaselineCarKm).toBe(0);expect(green.weeklyCo2SavedKg).toBe(0);
  });
  it('strips names, custom titles, roles and clinician text from model context',()=>{
    const p=payload();p.household.members[0].role='PRIVATE_ROLE';p.household.members[0].sensitivities.clinicianPrecautionsNote='PRIVATE_NOTE';p.household.members[0].activities[0].title='PRIVATE_TITLE';
    p.passports=p.household.members.map(m=>buildMemberPassport(m,p.environment,p.household.resources));
    const context=JSON.stringify(buildAnonymizedGroundingContext(p));
    for(const privateText of ['Rajesh','PRIVATE_ROLE','PRIVATE_NOTE','PRIVATE_TITLE']) expect(context).not.toContain(privateText);
  });
  it('rejects nested malformed API payloads with 400, not a server crash',async()=>{
    const res=await request(createApp()).post('/api/assistant').send({question:'hello',household:{},environment:{},passports:[],conflictResult:{}});
    expect(res.status).toBe(400);
  });
  it('recovers from malformed persisted profiles',()=>{
    localStorage.setItem('vayuguard_household_v1',JSON.stringify({members:[{}],location:{}}));
    expect(loadStoredHousehold()).toBeNull();localStorage.clear();
  });
  it('handles fractional concentrations at CPCB interval boundaries',()=>{
    expect(computeIllustrativeCpcbPm25SubIndex(30.0005)?.category).toBe('Satisfactory');
    expect(computeIllustrativeCpcbPm25SubIndex(60.0005)?.subIndex).toBe(101);
  });
  it('repairs changed forecasts but is silent for identical input',()=>{
    const {household,environment}=fixture(20);
    expect(compareForecastsAndRepair(household,environment,environment).hasChanges).toBe(false);
    const spike=buildSimulatedSpikeEnvironment(environment);
    expect(compareForecastsAndRepair(household,environment,spike).hasChanges).toBe(true);
    expect(spike.hourly.find(h=>h.hour===17)?.usAqi).toBeNull();
  });
});
