import type { AgeGroup, FamilyMember, PrecautionTier } from '../shared/types.js';

export interface SensitivityEvaluation {
  multiplier: number;
  isHighSensitivity: boolean;
  coldAirSensitive: boolean;
  smokeSensitive: boolean;
  factors: string[];
  urgentCareTriggered: boolean;
  urgentCareMessage?: string;
  clinicianNote?: string;
}

export const URGENT_CARE_GUIDANCE =
  'Severe breathing difficulty requires prompt medical evaluation. Pause outdoor activities and routine optimization immediately, follow your clinician-prescribed emergency action plan if you have one, and seek urgent medical care or call emergency services (108 / 112 in India) now for severe breathing distress, chest pain, bluish lips, or difficulty speaking. Do not wait for symptoms to persist.';

export const FEVER_SAFETY_NOTE =
  'Fever is not a routine air-pollution symptom and may indicate an infection or other medical condition. Please consult a qualified doctor rather than attributing fever to air quality.';

export function evaluateMemberSensitivity(member: FamilyMember): SensitivityEvaluation {
  const s = member.sensitivities;
  let multiplier = 1.0;
  const factors: string[] = [];

  const ageFactorMap: Record<AgeGroup, { mult: number; label?: string }> = {
    infant_toddler: { mult: 1.35, label: 'Infant / toddler developing airways' },
    child: { mult: 1.25, label: 'School-age child (higher breathing rate per body weight)' },
    teen_student: { mult: 1.05 },
    adult: { mult: 1.0 },
    older_adult: { mult: 1.25, label: 'Older adult age-related sensitivity' },
  };

  const ageEntry = ageFactorMap[member.ageGroup];
  multiplier *= ageEntry.mult;
  if (ageEntry.label) factors.push(ageEntry.label);

  if (s.diagnosedAsthma === 'yes') {
    multiplier *= 1.4;
    factors.push('Reported diagnosed asthma');
  } else if (s.diagnosedAsthma === 'not_sure') {
    multiplier *= 1.1;
    factors.push('Uncertain asthma history (conservative precaution)');
  }

  if (s.otherRespiratoryCondition === 'yes') {
    multiplier *= 1.3;
    factors.push('Existing respiratory condition reported');
  }

  if (s.dustOrSeasonalAllergy === 'yes') {
    multiplier *= 1.15;
    factors.push('Dust or seasonal allergy sensitivity');
  }

  const smokeSensitive = s.smokeOrCropBurningSensitivity === 'yes';
  if (smokeSensitive) {
    multiplier *= 1.15;
    factors.push('Smoke / biomass haze sensitivity');
  }

  const coldAirSensitive = s.coldAirSensitivity === 'yes';
  if (coldAirSensitive) {
    multiplier *= 1.1;
    factors.push('Cold-air airway sensitivity');
  }

  if (s.frequentIrritationDuringSmog === 'yes') {
    multiplier *= 1.1;
    factors.push('Frequent irritation during hazy periods');
  }

  const isHighSensitivity =
    s.diagnosedAsthma === 'yes' ||
    s.otherRespiratoryCondition === 'yes' ||
    member.ageGroup === 'infant_toddler' ||
    member.ageGroup === 'child' ||
    member.ageGroup === 'older_adult' ||
    multiplier >= 1.25;

  return {
    multiplier: Number(multiplier.toFixed(2)),
    isHighSensitivity,
    coldAirSensitive,
    smokeSensitive,
    factors: factors.length > 0 ? factors : ['General household baseline precaution'],
    urgentCareTriggered: Boolean(s.urgentSymptomsReported) || checkSymptomSafetyGuidance(s.clinicianPrecautionsNote).urgentCareRequired,
    urgentCareMessage: (s.urgentSymptomsReported || checkSymptomSafetyGuidance(s.clinicianPrecautionsNote).urgentCareRequired) ? URGENT_CARE_GUIDANCE : undefined,
    clinicianNote: s.clinicianPrecautionsNote?.trim() || undefined,
  };
}

export function precautionTierLabel(tier: PrecautionTier): string {
  switch (tier) {
    case 'low':
      return 'Low Precaution';
    case 'moderate':
      return 'Moderate Precaution';
    case 'high':
      return 'High Precaution';
    case 'stay_indoors':
      return 'Stay Indoors / Minimize Exposure';
  }
}

export function determinePrecautionTier(
  pm25: number | null,
  usAqi: number | null,
  sensitivity: SensitivityEvaluation,
): PrecautionTier {
  if (sensitivity.urgentCareTriggered) {
    return 'stay_indoors';
  }

  if (pm25 !== null && usAqi !== null) {
    const ranks: PrecautionTier[] = ['low', 'moderate', 'high', 'stay_indoors'];
    const pmTier = determinePrecautionTier(pm25, null, sensitivity);
    const aqTier = determinePrecautionTier(null, usAqi, sensitivity);
    return ranks[Math.max(ranks.indexOf(pmTier), ranks.indexOf(aqTier))];
  }

  // Adjust thresholds tighter for higher-sensitivity household members
  const scale = sensitivity.isHighSensitivity ? 0.72 : 1.0;

  if (pm25 !== null && Number.isFinite(pm25)) {
    if (pm25 <= 25 * scale) return 'low';
    if (pm25 <= 55 * scale) return 'moderate';
    if (pm25 <= 115 * scale) return 'high';
    return 'stay_indoors';
  }

  if (usAqi !== null && Number.isFinite(usAqi)) {
    if (usAqi <= 50 * scale) return 'low';
    if (usAqi <= 100 * scale) return 'moderate';
    if (usAqi <= 160 * scale) return 'high';
    return 'stay_indoors';
  }

  // Conservative fallback when pollutant data is unavailable
  return sensitivity.isHighSensitivity ? 'high' : 'moderate';
}

export function checkSymptomSafetyGuidance(inputText: string): {
  urgentCareRequired: boolean;
  feverMentioned: boolean;
  safetyMessages: string[];
} {
  const lower = inputText.toLowerCase();
  const urgentKeywords = [
    'severe breathing',
    'can\'t breathe',
    'cannot breathe',
    'shortness of breath',
    'gasping',
    'can’t breathe',
    'saah nahi',
    'saans nahi',
    'सांस नहीं',
    'ਸਾਹ ਨਹੀਂ',
    'chest tightness',
    'chest pain',
    'wheezing badly',
    'blue lips',
    'struggling to breathe',
    'saans lene mein dikkat',
    'saans phool',
    'सांस लेने में',
    'ਸਾਹ ਲੈਣ ਵਿੱਚ',
  ];
  const feverKeywords = ['fever', 'bukhar', 'bukhaar', 'बुखार', 'ਬੁਖਾਰ'];

  const urgentCareRequired = urgentKeywords.some((k) => lower.includes(k));
  const feverMentioned = feverKeywords.some((k) => lower.includes(k));

  const safetyMessages: string[] = [];
  if (urgentCareRequired) safetyMessages.push(URGENT_CARE_GUIDANCE);
  if (feverMentioned) safetyMessages.push(FEVER_SAFETY_NOTE);

  return { urgentCareRequired, feverMentioned, safetyMessages };
}
