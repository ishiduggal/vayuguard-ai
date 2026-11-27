import { afterEach, describe, expect, it, vi } from 'vitest';
const create = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({GoogleGenAI: class { interactions = {create}; }}));
import { generateAssistantReply } from '../server/geminiService.js';
import { createPatialaDemoHousehold, buildOfflineFallbackEnvironment } from '../src/shared/presets.js';
import { buildMemberPassport, solveHouseholdConflicts } from '../src/engine/index.js';
function makePayload() {
 const household=createPatialaDemoHousehold(), environment=buildOfflineFallbackEnvironment(household.location);
 const passports=household.members.map(m=>buildMemberPassport(m,environment,household.resources));
 return {question:'Explain the plan',language:'en' as const,household,environment,passports,conflictResult:solveHouseholdConflicts(household,passports,environment)};
}
afterEach(()=>{vi.unstubAllEnvs();create.mockReset();});
describe('Gemini SDK boundary (mocked, not a live API verification)',()=>{
 it.each(['output_text','outputs'])('accepts %s responses and sends minimized context',async(shape)=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-placeholder');
  const text=JSON.stringify({summary:'Follow your plan',actionSteps:['Review the routine'],precautionNote:'Non-clinical',groundingNote:'Provided forecast'});
  create.mockResolvedValue(shape==='output_text'?{output_text:text}:{outputs:[{type:'text',text}]});
  const response=await generateAssistantReply(makePayload());expect(response.usedGemini).toBe(true);
  const args=create.mock.calls[0][0];expect(args.store).toBe(false);expect(args.input).not.toContain('Rajesh');expect(args.input).not.toContain('reliever inhaler');
 });
 it('falls back on malformed JSON without exposing upstream error details',async()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-placeholder');create.mockRejectedValue(new Error('SECRET upstream detail'));
  const response=await generateAssistantReply(makePayload());expect(response.usedGemini).toBe(false);expect(JSON.stringify(response)).not.toContain('SECRET');
 });
 it('does not invoke Gemini for a profile emergency even with a neutral question',async()=>{
  vi.stubEnv('GEMINI_API_KEY','test-only-placeholder');const p=makePayload();p.passports[0].urgentCareTriggered=true;
  expect((await generateAssistantReply(p)).usedGemini).toBe(false);expect(create).not.toHaveBeenCalled();
 });
});
