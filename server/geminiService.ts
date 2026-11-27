import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { formatHourLabel } from '../src/shared/aqi.js';
import type {
  AssistantStructuredReply,
  ConflictSolverResult,
  EnvironmentBundle,
  HouseholdProfile,
  Language,
  MemberPassport,
  PlanRepairReport,
} from '../src/shared/types.js';
import { checkSymptomSafetyGuidance } from '../src/engine/safetyRules.js';
import { buildIndoorAirPlan } from '../src/engine/indoorAir.js';

const AssistantJsonSchema = z.object({
  summary: z.string().min(1),
  actionSteps: z.array(z.string()).min(1).max(6),
  precautionNote: z.string().min(1),
  groundingNote: z.string().min(1),
});

export interface AssistantRequestPayload {
  question: string;
  language: Language;
  household: HouseholdProfile;
  environment: EnvironmentBundle;
  passports: MemberPassport[];
  conflictResult: ConflictSolverResult;
  planRepair?: PlanRepairReport | null;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (Devanagari script, natural everyday phrasing)',
  pa: 'Punjabi (Gurmukhi script, warm family-friendly phrasing)',
  pa_roman: 'Roman Punjabi (Punjabi written in Latin letters, e.g. "Ajj savere bahar walk na karo...")',
};

/**
 * Privacy-by-design sanitizer: removes member real names and free-text medical notes
 * before sending household context to Gemini, replacing them with anonymized role tags.
 */
export function buildAnonymizedGroundingContext(payload: AssistantRequestPayload): Record<string, unknown> {
  const { environment, household, passports, conflictResult, planRepair } = payload;

  return {
    city: `${environment.location.name}, ${environment.location.state}`,
    dataKind: environment.dataKind,
    source: environment.source,
    aqiStandard: environment.aqiStandard,
    currentConditions: {
      pm25UgM3: environment.current.pm25,
      pm10UgM3: environment.current.pm10,
      usAqi: environment.current.usAqi,
      temperatureC: environment.current.temperatureC,
      windSpeedKmh: environment.current.windSpeedKmh,
      boundaryLayerHeightM: environment.current.boundaryLayerHeightM,
    },
    cleanestForecastHours: [...environment.hourly]
      .filter((h) => h.pm25 !== null)
      .sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999))
      .slice(0, 3)
      .map((h) => ({ hour: formatHourLabel(h.hour), pm25UgM3: h.pm25, usAqi: h.usAqi })),
    householdResources: {
      hasAirPurifier: household.resources.hasAirPurifier,
      hasAirConditioning: household.resources.hasAirConditioning,
      hasExhaustFan: household.resources.hasExhaustFan,
      limitedBudget: household.resources.limitedBudget,
      hasPublicTransitAccess: household.resources.hasPublicTransitAccess,
    },
    anonymizedMembers: passports.map((p, idx) => ({
      memberTag: `Member ${idx + 1} (${p.ageGroup})`,
      precautionTier: p.precautionLabel,
      generalizedFactorsCount: p.sensitivityFactors.length,
      timeline: p.timeline.map((t) => ({
        activity: t.category,
        flexibility: t.flexibility,
        recommendedTime: formatHourLabel(t.recommendedHour),
        outdoor: t.isOutdoorRecommended,
        precautionTier: t.precautionTier,
        indoorAlternative: t.indoorAlternativeUsed,
        urgentCare: p.urgentCareTriggered,
      })),
    })),
    coordinatedSavings: {
      avoidedSoloCarKmPerDay: conflictResult.totalAvoidedKm,
      combinedTripsCount: conflictResult.combinedTrips.length,
      benefits: conflictResult.practicalBenefits,
    },
    planRepairChanged: Boolean(planRepair?.hasChanges),
  };
}

export function buildDeterministicAssistantReply(
  payload: AssistantRequestPayload,
  fallbackReason?: string,
): AssistantStructuredReply {
  const { question, language, environment, household, passports, conflictResult, planRepair } = payload;
  const q = question.toLowerCase();
  const safety = checkSymptomSafetyGuidance(question);

  const pm25 = environment.current.pm25 !== null ? Math.round(environment.current.pm25) : null;
  const usAqi = environment.current.usAqi !== null ? Math.round(environment.current.usAqi) : null;
  const bestHour = [...environment.hourly]
    .filter((h) => h.pm25 !== null)
    .sort((a, b) => (a.pm25 ?? 999) - (b.pm25 ?? 999))[0];
  const indoorPlan = buildIndoorAirPlan(household.resources, environment);

  if (safety.urgentCareRequired || passports.some(p => p.urgentCareTriggered)) {
    const urgentSummary: Record<Language, string> = {
      en: 'Urgent medical safety first: severe breathing difficulty should be evaluated by a clinician right away.',
      hi: 'तुरंत चिकित्सकीय सुरक्षा: सांस लेने में गंभीर तकलीफ होने पर तुरंत डॉक्टर या नजदीकी इमरजेंसी से संपर्क करें।',
      pa: 'ਤੁਰੰਤ ਡਾਕਟਰੀ ਸੁਰੱਖਿਆ: ਸਾਹ ਲੈਣ ਵਿੱਚ ਗੰਭੀਰ ਦਿੱਕਤ ਹੋਵੇ ਤਾਂ ਤੁਰੰਤ ਡਾਕਟਰ ਜਾਂ ਨਜ਼ਦੀਕੀ ਐਮਰਜੈਂਸੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      pa_roman: 'Turant medical suraksha: agar saah lain vich zyada takleef hai taan turant doctor ya emergency (108/112) kol jao.',
    };
    return {
      language,
      usedGemini: false,
      summary: urgentSummary[language],
      actionSteps: [urgentSummary[language]],
      precautionNote: 'Do not use routine outdoor scheduling or air quality tips in place of urgent care.',
      groundingNote: 'Triggered by deterministic public-health safety rules.',
      fallbackReason,
    };
  }

  let summary = '';
  let actionSteps: string[] = [];

  if (q.includes('purifier') || q.includes('afford') || q.includes('indoor') || q.includes('ghar') || q.includes('ਘਰ') || q.includes('घर')) {
    const freeSteps = indoorPlan.recommendations.filter((r) => r.tier === 'free').map((r) => `${r.title}: ${r.action}`);
    if (language === 'hi') {
      summary = `बिना महंगे एयर प्यूरीफायर के भी आप घर की हवा बेहतर रख सकते हैं। अभी बाहर PM2.5 लगभग ${pm25 ?? 'N/A'} µg/m³ है।`;
    } else if (language === 'pa') {
      summary = `ਮਹਿੰਗੇ ਏਅਰ ਪਿਊਰੀਫਾਇਰ ਤੋਂ ਬਿਨਾਂ ਵੀ ਤੁਸੀਂ ਘਰ ਦੀ ਹਵਾ ਸਾਫ਼ ਰੱਖ ਸਕਦੇ ਹੋ। ਇਸ ਵੇਲੇ ਬਾਹਰ PM2.5 ਲਗਭਗ ${pm25 ?? 'N/A'} µg/m³ ਹੈ।`;
    } else if (language === 'pa_roman') {
      summary = `Mehnge air purifier ton bina vi tusi ghar di hawa behtar rakh sakde ho. Is vele bahar PM2.5 lagbhag ${pm25 ?? 'N/A'} µg/m³ hai.`;
    } else {
      summary = `You do not need an expensive air purifier to reduce indoor pollution. Current outdoor PM2.5 in ${environment.location.name} is ${pm25 ?? 'N/A'} µg/m³.`;
    }
    actionSteps = [indoorPlan.ventilationWindowAdvice, ...freeSteps.slice(0, 3)];
  } else if (q.includes('walk') || q.includes('सैर') || q.includes('ਸੈਰ') || q.includes('sair') || q.includes('when')) {
    const bestText = bestHour
      ? `${formatHourLabel(bestHour.hour)} (~${Math.round(bestHour.pm25 ?? 0)} µg/m³ PM2.5)`
      : 'midday afternoon hours';
    if (language === 'hi') {
      summary = `सर्दियों की सुबह हवा ज़मीन के पास धुंध को रोके रखती है, इसलिए हमेशा सुबह की सैर सबसे सुरक्षित नहीं होती। आज सबसे कम प्रदूषण का समय लगभग ${bestText} है।`;
    } else if (language === 'pa') {
      summary = `ਸਰਦੀਆਂ ਦੀ ਸਵੇਰ ਨੂੰ ਧੁੰਦ ਤੇ ਧੂੰਆਂ ਜ਼ਮੀਨ ਦੇ ਨੇੜੇ ਫਸਿਆ ਰਹਿੰਦਾ ਹੈ। ਅੱਜ ਸਭ ਤੋਂ ਘੱਟ ਪ੍ਰਦੂਸ਼ਣ ਵਾਲਾ ਸਮਾਂ ਲਗਭਗ ${bestText} ਹੈ।`;
    } else if (language === 'pa_roman') {
      summary = `Sardiyan di savere hawa zameen de nede dhuaan rok lendi hai. Ajj sab ton ghat pollution wala samaan lagbhag ${bestText} hai.`;
    } else {
      summary = `Morning is not automatically cleanest in winter — shallow dawn mixing traps smog. Today’s lowest modeled PM2.5 window is around ${bestText}.`;
    }
    actionSteps = passports.slice(0, 3).map((p) => `${p.memberName}: ${p.suggestedTimeWindows[0] ?? p.todayOutlook}`);
  } else if (q.includes('change') || q.includes('repair') || q.includes('spike') || q.includes('बदला') || q.includes('ਬਦਲਿਆ')) {
    summary = planRepair?.hasChanges
      ? planRepair.summary
      : `Current routines reflect ${environment.location.name}’s latest ${environment.forecastHorizonHours}h forecast (PM2.5 ${pm25 ?? 'N/A'} µg/m³, US AQI ${usAqi ?? 'N/A'}). Trigger "Simulate Forecast Change" or refresh data to inspect Plan Repair updates.`;
    actionSteps = planRepair?.hasChanges
      ? planRepair.changes.slice(0, 4).map((c) => `${c.memberName} (${c.activityTitle}): ${c.whatChanged}. ${c.suggestedAlternative}`)
      : passports.slice(0, 3).map((p) => `${p.memberName}: ${p.timeline[0]?.suggestedAction ?? p.todayOutlook}`);
  } else if (q.includes('car') || q.includes('trip') || q.includes('emission') || q.includes('गाड़ी') || q.includes('ਗੱਡੀ')) {
    summary = `Your Household Conflict Solver found ${conflictResult.combinedTrips.length} trip-chaining opportunity with ${conflictResult.totalAvoidedKm} km/day of confirmed savings. Candidates require route and availability confirmation.`;
    actionSteps = [
      ...conflictResult.combinedTrips.map((t) => `${t.title}: ${t.coordinatedPlanSummary}`),
      ...conflictResult.practicalBenefits.slice(0, 2),
    ];
  } else {
    const highRiskMembers = passports.filter(
      (p) => p.precautionTier === 'high' || p.precautionTier === 'stay_indoors',
    );
    if (language === 'hi') {
      summary = `${environment.location.name} में अभी PM2.5 लगभग ${pm25 ?? 'N/A'} µg/m³ (US AQI ${usAqi ?? 'N/A'}) है। ${highRiskMembers.map((m) => m.memberName).join(', ') || 'संवेदनशील सदस्यों'} को अतिरिक्त सावधानी रखनी चाहिए।`;
      actionSteps = passports.slice(0, 4).map((p) => {
        const first = p.timeline[0];
        if (!first) return `${p.memberName}: घर के अंदर सुरक्षित दिनचर्या रखें।`;
        return first.indoorAlternativeUsed
          ? `${p.memberName}: बाहरी गतिविधि घर के अंदर करें (${formatHourLabel(first.recommendedHour)})।`
          : `${p.memberName}: ${formatHourLabel(first.recommendedHour)} पर बाहर जाने पर N95 मास्क व सावधानी रखें।`;
      });
    } else if (language === 'pa') {
      summary = `${environment.location.name} ਵਿੱਚ ਇਸ ਵੇਲੇ PM2.5 ਲਗਭਗ ${pm25 ?? 'N/A'} µg/m³ (US AQI ${usAqi ?? 'N/A'}) ਹੈ। ${highRiskMembers.map((m) => m.memberName).join(', ') || 'ਸੰਵੇਦਨਸ਼ੀਲ ਮੈਂਬਰਾਂ'} ਲਈ ਵਾਧੂ ਸਾਵਧਾਨੀ ਜ਼ਰੂਰੀ ਹੈ।`;
      actionSteps = passports.slice(0, 4).map((p) => {
        const first = p.timeline[0];
        if (!first) return `${p.memberName}: ਘਰ ਦੇ ਅੰਦਰ ਸੁਰੱਖਿਅਤ ਰੁਟੀਨ ਰੱਖੋ।`;
        return first.indoorAlternativeUsed
          ? `${p.memberName}: ਬਾਹਰੀ ਗਤੀਵਿਧੀ ਘਰ ਦੇ ਅੰਦਰ ਕਰੋ (${formatHourLabel(first.recommendedHour)})।`
          : `${p.memberName}: ${formatHourLabel(first.recommendedHour)} ਵੇਲੇ N95 ਮਾਸਕ ਅਤੇ ਸਾਵਧਾਨੀ ਵਰਤੋ।`;
      });
    } else if (language === 'pa_roman') {
      summary = `${environment.location.name} vich is vele PM2.5 lagbhag ${pm25 ?? 'N/A'} µg/m³ (US AQI ${usAqi ?? 'N/A'}) hai. ${highRiskMembers.map((m) => m.memberName).join(', ') || 'Sensitive family members'} nu khaas dhyan rakhna chahida hai.`;
      actionSteps = passports.slice(0, 4).map((p) => {
        const first = p.timeline[0];
        if (!first) return `${p.memberName}: Ghar de andar safe routine rakho.`;
        return first.indoorAlternativeUsed
          ? `${p.memberName}: Bahar wali activity ghar de andar karo (${formatHourLabel(first.recommendedHour)}).`
          : `${p.memberName}: ${formatHourLabel(first.recommendedHour)} nu bahar jaan vele N95 mask te dhyan rakho.`;
      });
    } else {
      summary = `In ${environment.location.name}, current modeled PM2.5 is ${pm25 ?? 'N/A'} µg/m³ (US AQI ${usAqi ?? 'N/A'}). ${highRiskMembers.length > 0 ? `${highRiskMembers.map((m) => m.memberName).join(', ')} need higher precautions today.` : 'Moderate precautions apply across the household.'}`;
      actionSteps = passports.slice(0, 4).map((p) => {
        const first = p.timeline[0];
        return first ? `${p.memberName} (${p.precautionLabel}): ${first.suggestedAction}` : `${p.memberName}: ${p.todayOutlook}`;
      });
    }
  }

  // Localized deterministic fallback steps use only safe, bounded templates.
  if (language !== 'en') {
    const copy = {
      hi: {
        indoor: ['गीला पोछा लगाएँ; धूल उड़ाने वाली सूखी झाड़ू से बचें।', 'घर में धूम्रपान, अगरबत्ती और धूप का धुआँ रोकें।', 'गैस या लकड़ी पर खाना बनाते समय रसोई का निकास और हवा का रास्ता खुला रखें।'],
        open: 'बाहर के हालात दोबारा जाँचकर थोड़ी देर हवा आने दें।',
        closed: 'नियमित खिड़कियाँ खोलना टालें; खाना बनाते समय जरूरी वेंटिलेशन बनाए रखें।',
        inside: 'बाहरी गतिविधि की जगह घर के अंदर हल्की गतिविधि करें, केवल आराम महसूस होने पर।',
        fixed: 'तय समय बरकरार है; सदस्य की व्यक्तिगत सावधानियाँ देखें।',
        cautious: 'यह अपेक्षाकृत बेहतर समय है, सुरक्षित होने की गारंटी नहीं। व्यक्तिगत सावधानियाँ देखें।',
        trip: 'साझा यात्रा से पहले रास्ता, सीट, चालक और पहुँचने का समय तय करें। अभी कोई बचत प्रमाणित नहीं है।',
      },
      pa: {
        indoor: ['ਗਿੱਲਾ ਪੋਚਾ ਲਾਓ; ਧੂੜ ਉਡਾਉਣ ਵਾਲੀ ਸੁੱਕੀ ਝਾੜੂ ਤੋਂ ਬਚੋ।', 'ਘਰ ਵਿੱਚ ਸਿਗਰਟ, ਅਗਰਬੱਤੀ ਅਤੇ ਧੂਪ ਦਾ ਧੂੰਆਂ ਰੋਕੋ।', 'ਗੈਸ ਜਾਂ ਲੱਕੜ ਨਾਲ ਖਾਣਾ ਬਣਾਉਂਦੇ ਸਮੇਂ ਰਸੋਈ ਦਾ ਨਿਕਾਸ ਅਤੇ ਹਵਾ ਦਾ ਰਸਤਾ ਖੁੱਲ੍ਹਾ ਰੱਖੋ।'],
        open: 'ਬਾਹਰ ਦੇ ਹਾਲਾਤ ਮੁੜ ਵੇਖ ਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਹਵਾ ਆਉਣ ਦਿਓ।',
        closed: 'ਆਮ ਖਿੜਕੀਆਂ ਖੋਲ੍ਹਣਾ ਟਾਲੋ; ਖਾਣਾ ਬਣਾਉਂਦੇ ਸਮੇਂ ਜ਼ਰੂਰੀ ਹਵਾਦਾਰੀ ਰੱਖੋ।',
        inside: 'ਬਾਹਰੀ ਸਰਗਰਮੀ ਦੀ ਥਾਂ ਘਰ ਅੰਦਰ ਹਲਕੀ ਸਰਗਰਮੀ ਕਰੋ, ਸਿਰਫ਼ ਆਰਾਮ ਮਹਿਸੂਸ ਹੋਣ ਤੇ।',
        fixed: 'ਤੈਅ ਸਮਾਂ ਬਰਕਰਾਰ ਹੈ; ਮੈਂਬਰ ਦੀਆਂ ਨਿੱਜੀ ਸਾਵਧਾਨੀਆਂ ਵੇਖੋ।',
        cautious: 'ਇਹ ਮੁਕਾਬਲਤਨ ਬਿਹਤਰ ਸਮਾਂ ਹੈ, ਸੁਰੱਖਿਆ ਦੀ ਗਾਰੰਟੀ ਨਹੀਂ। ਨਿੱਜੀ ਸਾਵਧਾਨੀਆਂ ਵੇਖੋ।',
        trip: 'ਸਾਂਝੇ ਸਫ਼ਰ ਤੋਂ ਪਹਿਲਾਂ ਰਸਤਾ, ਸੀਟ, ਡਰਾਈਵਰ ਅਤੇ ਪਹੁੰਚਣ ਦਾ ਸਮਾਂ ਪੱਕਾ ਕਰੋ। ਹਾਲੇ ਕੋਈ ਬੱਚਤ ਪ੍ਰਮਾਣਿਤ ਨਹੀਂ।',
      },
      pa_roman: {
        indoor: ['Gilla pocha lao; sukki jhaaru naal dhoor na udao.', 'Ghar andar smoking, agarbatti te dhoop da dhuaan roko.', 'Gas ja lakri te khana banaunde vele kitchen exhaust te hawa da rasta khulla rakho.'],
        open: 'Bahar de halaat dubara vekh ke thori der hawa aun deo.',
        closed: 'Aam khirkian kholna taalo; khana banaunde vele zaroori ventilation rakho.',
        inside: 'Bahar di activity di thaan andar halki activity karo, sirf je aaram mehsoos hove.',
        fixed: 'Tay samaan barkarar hai; member dian apnian savdhanian vekho.',
        cautious: 'Eh mukabaltan behtar samaan hai, safety di guarantee nahi. Apnian savdhanian vekho.',
        trip: 'Sanjhe safar ton pehlan route, seat, driver te pahunchan da samaan pakka karo. Hale koi saving confirm nahi.',
      },
    }[language];
    if (/purifier|afford|indoor|ghar|ਘਰ|घर/.test(q)) {
      actionSteps = [indoorPlan.safeToOpenWindowsNow ? copy.open : copy.closed, ...copy.indoor];
    } else if (/car|trip|emission|गाड़ी|ਗੱਡੀ/.test(q)) {
      actionSteps = [copy.trip];
      summary = copy.trip;
    } else {
      actionSteps = passports.map(p => {
        const t = p.timeline.find(t => t.flexibility === 'flexible') ?? p.timeline[0];
        return `${p.memberName}: ${t ? formatHourLabel(t.recommendedHour) : ''} — ${t?.indoorAlternativeUsed ? copy.inside : t?.flexibility === 'fixed' ? copy.fixed : copy.cautious}`;
      }).slice(0, 6);
    }
  }

  const extraSafety = safety.feverMentioned ? ` ${safety.safetyMessages.join(' ')}` : '';

  return {
    language,
    usedGemini: false,
    summary,
    actionSteps: actionSteps.length > 0 ? actionSteps : ['Follow your family timeline precautions and check afternoon dispersion windows.'],
    precautionNote:
      `Non-clinical guidance only — does not diagnose or replace your doctor’s advice.${extraSafety}`,
    groundingNote: `Grounded in ${environment.source} (${environment.dataKind}, fetched ${environment.fetchedAt}).`,
    fallbackReason,
  };
}

export async function generateAssistantReply(
  payload: AssistantRequestPayload,
): Promise<AssistantStructuredReply> {
  const safety = checkSymptomSafetyGuidance(payload.question);
  if (safety.urgentCareRequired || payload.passports.some(p => p.urgentCareTriggered)) {
    // Never let an LLM override urgent care guidance
    return buildDeterministicAssistantReply(payload);
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildDeterministicAssistantReply(
      payload,
      'GEMINI_API_KEY not configured on server; served by deterministic multilingual engine.',
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
  const context = buildAnonymizedGroundingContext(payload);

  const systemInstruction = [
    'You are VayuGuard AI, a calm, practical family air-quality decision assistant.',
    'STRICT RULES:',
    '1. Ground every number, pollutant level, and recommended hour strictly in the provided JSON context. NEVER invent measurements or timestamps.',
    '2. NEVER diagnose diseases, prescribe medication, modify clinician treatment, or claim fever is caused by pollution.',
    '3. If severe breathing difficulty is mentioned, advise immediate urgent medical care.',
    '4. NEVER label outdoor hours safe if the deterministic engine marked them elevated or shifted them indoors.',
    `5. Respond in ${LANGUAGE_LABELS[payload.language]}.`,
    '6. Return valid JSON matching the requested schema.',
  ].join('\n');

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 20000 } });
    const interaction = await ai.interactions.create({
      model: modelName,
      system_instruction: systemInstruction,
      input: `Verified household context (anonymized):\n${JSON.stringify(context)}\n\nFamily question: ${payload.question}`,
      store: false,
      response_mime_type: 'application/json',
      response_format: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Direct 1-2 sentence answer in target language' },
          actionSteps: {
            type: 'array',
            items: { type: 'string' },
            description: '3 to 5 concrete practical steps grounded in the context',
          },
          precautionNote: { type: 'string', description: 'Non-clinical precaution & safety reminder' },
          groundingNote: { type: 'string', description: 'Data source & limitation note' },
        },
        required: ['summary', 'actionSteps', 'precautionNote', 'groundingNote'],
      },
    });

    const textParts = (interaction.outputs ?? [])
      .filter((o): o is { type: 'text'; text: string } => o.type === 'text' && typeof o.text === 'string')
      .map((o) => o.text);
    const outputText = (interaction as unknown as { output_text?: string }).output_text;
    const rawText = (outputText || textParts.join('\n')).trim();
    const parsed = AssistantJsonSchema.parse(JSON.parse(rawText));

    const feverAppendix = safety.feverMentioned ? ` ${safety.safetyMessages.join(' ')}` : '';
    return {
      language: payload.language,
      usedGemini: true,
      modelName,
      summary: parsed.summary,
      actionSteps: parsed.actionSteps,
      precautionNote: `${parsed.precautionNote}${feverAppendix}`.trim(),
      groundingNote: parsed.groundingNote,
    };
  } catch {
    return buildDeterministicAssistantReply(
      payload,
      'Gemini is unavailable; showing limited deterministic guidance.',
    );
  }
}
