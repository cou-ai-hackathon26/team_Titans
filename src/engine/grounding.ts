import { DGDA_DRUG_DATABASE } from '../data/dgdaDatabase';
import type {
  CandidateMatch,
  DgdaDrugRecord,
  DosageForm,
  MealTiming,
  RawVlmMedicationLine,
  ScoreBreakdown,
} from '../types/clinical';

/**
 * Calibrated safety threshold from OshudhGuard AI Stage 3 specification.
 * Scores below 0.78 trigger Human-in-the-Loop Ambiguity Alert instead of guessing.
 */
export const AMBIGUITY_THRESHOLD = 0.78;

/**
 * Multi-factor ranking weights:
 * S(q, c_i) = alpha * cos(e_q, e_ci) + beta * Lev_norm(q, c_i)
 *           + gamma * Phon(q, c_i) + delta * Phi(f_q, s_q, t_q, c_i)
 */
export const RANKING_WEIGHTS = {
  alpha: 0.32,
  beta: 0.28,
  gamma: 0.16,
  delta: 0.24,
} as const;

const FORM_PREFIX_REGEX =
  /^\s*(?:tab\.?|tablet|cap\.?|capsule|syp\.?|syrup|susp\.?|suspension|inj\.?|injection|drop|drops|gel|inhaler)\s+/i;

const STRENGTH_REGEX =
  /(\d+(?:\.\d+)?)\s*(?:mg|mcg|gm|g|ml|iu)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:mg|mcg|iu))?/i;

export function normalizeBrandQuery(raw: string): string {
  return raw
    .replace(FORM_PREFIX_REGEX, '')
    .replace(STRENGTH_REGEX, '')
    .replace(/\b\d+(?:\.\d+)?\b/g, '')
    .replace(/[^a-zA-Z0-9\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractDosageFormHint(raw: string, explicitHint?: string): DosageForm | null {
  const combined = `${explicitHint ?? ''} ${raw}`.toLowerCase();
  if (/\bcap\.?|\bcapsule/.test(combined)) return 'Capsule';
  if (/\btab\.?|\btablet/.test(combined)) return 'Tablet';
  if (/\bsyp\.?|\bsyrup/.test(combined)) return 'Syrup';
  if (/\bsusp\.?|\bsuspension/.test(combined)) return 'Suspension';
  if (/\binj\.?|\binjection/.test(combined)) return 'Injection';
  if (/\binhaler|\bpuff/.test(combined)) return 'Inhaler';
  if (/\bdrop/.test(combined)) return 'Drops';
  if (/\bgel|\bcream|\boint/.test(combined)) return 'Gel';
  return null;
}

export function extractStrengthMgHint(raw: string, explicitHint?: string): number | null {
  const combined = `${explicitHint ?? ''} ${raw}`;
  const mgMatch = combined.match(/(\d+(?:\.\d+)?)\s*(mg|mcg)/i);
  if (mgMatch) {
    const value = parseFloat(mgMatch[1]);
    return mgMatch[2].toLowerCase() === 'mcg' ? value / 1000 : value;
  }
  // Trailing standalone strength number like "Cap. Srgel 20" or "Monas 10"
  const trailingNum = raw.trim().match(/\b(\d+(?:\.\d+)?)\s*$/);
  if (trailingNum) {
    const val = parseFloat(trailingNum[1]);
    if (val > 0 && val <= 2000) return val;
  }
  return null;
}

export function extractMealTimingHint(shorthand: string): MealTiming | null {
  const lower = shorthand.toLowerCase();
  if (/\ba\/c\b|before\s*meal|empty\s*stomach|খাবারের\s*আগে/.test(lower)) {
    return 'before_meal';
  }
  if (/\bp\/c\b|after\s*meal|খাবারের\s*পরে/.test(lower)) {
    return 'after_meal';
  }
  if (/\bhs\b|bedtime|at\s*night|0\+0\+1|রাতে/.test(lower)) {
    return 'bedtime';
  }
  if (/with\s*meal|খাবারের\s*সাথে/.test(lower)) {
    return 'with_meal';
  }
  return null;
}

/**
 * Character-aware dense n-gram vector representation (subword BGE-M3 style offline proxy).
 */
function buildCharNgramVector(text: string): Map<string, number> {
  const clean = `^${text.toLowerCase().replace(/[^a-z0-9]/g, '')}$`;
  const vec = new Map<string, number>();
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= clean.length - n; i++) {
      const gram = clean.slice(i, i + n);
      vec.set(gram, (vec.get(gram) ?? 0) + (n === 3 ? 1.35 : 1.0));
    }
  }
  // Add first-letter anchor weight for clinical brand prefixes
  if (clean.length > 2) {
    const prefix = `p:${clean[1]}`;
    vec.set(prefix, 1.5);
  }
  return vec;
}

export function characterCosineSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const vecA = buildCharNgramVector(normA);
  const vecB = buildCharNgramVector(normB);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [k, v] of vecA) {
    magA += v * v;
    const vb = vecB.get(k);
    if (vb !== undefined) dot += v * vb;
  }
  for (const [, v] of vecB) {
    magB += v * v;
  }

  if (magA === 0 || magB === 0) return 0;
  return Math.min(1, Math.max(0, dot / (Math.sqrt(magA) * Math.sqrt(magB))));
}

/**
 * Normalized Character Edit Similarity:
 * Lev_norm(q, c_i) = 1 - d_Levenshtein(q, c_i) / max(|q|, |c_i|)
 */
export function normalizedLevenshtein(a: string, b: string): number {
  const s = a.toLowerCase().trim();
  const t = b.toLowerCase().trim();
  const m = s.length;
  const n = t.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }

  const distance = prev[n];
  return Math.max(0, 1 - distance / Math.max(m, n));
}

/**
 * Double-Metaphone inspired dual-code phonetic encoder tuned for South Asian
 * medical brand orthography (e.g., Srgel/Sergel, Seklo/Seclo, Zimax/Zymax, Cipro/Sipro).
 */
export function doubleMetaphone(input: string): [string, string] {
  const clean = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return ['', ''];

  let primary = '';
  let secondary = '';
  let i = 0;

  const isVowel = (ch: string) => 'AEIOUY'.includes(ch);

  while (i < clean.length && primary.length < 6) {
    const ch = clean[i];
    const next = clean[i + 1] ?? '';
    const prev = clean[i - 1] ?? '';

    if (i === 0 && isVowel(ch)) {
      primary += 'A';
      secondary += 'A';
      i++;
      continue;
    }

    if (isVowel(ch)) {
      i++;
      continue;
    }

    // Skip repeated consecutive consonants
    if (ch === prev && ch !== 'C') {
      i++;
      continue;
    }

    switch (ch) {
      case 'B':
        primary += 'P';
        secondary += 'P';
        break;
      case 'C':
        if (next === 'H') {
          primary += 'K';
          secondary += 'X';
          i++;
        } else if ('EIY'.includes(next)) {
          primary += 'S';
          secondary += 'S';
        } else {
          primary += 'K';
          secondary += 'K';
        }
        break;
      case 'D':
        primary += 'T';
        secondary += 'T';
        break;
      case 'F':
        primary += 'F';
        secondary += 'F';
        break;
      case 'G':
        if ('EIY'.includes(next)) {
          primary += 'J';
          secondary += 'K';
        } else {
          primary += 'K';
          secondary += 'K';
        }
        break;
      case 'H':
        if (isVowel(next) && !isVowel(prev)) {
          primary += 'H';
          secondary += 'H';
        }
        break;
      case 'J':
        primary += 'J';
        secondary += 'J';
        break;
      case 'K':
        primary += 'K';
        secondary += 'K';
        break;
      case 'L':
        primary += 'L';
        secondary += 'L';
        break;
      case 'M':
        primary += 'M';
        secondary += 'M';
        break;
      case 'N':
        primary += 'N';
        secondary += 'N';
        break;
      case 'P':
        if (next === 'H') {
          primary += 'F';
          secondary += 'F';
          i++;
        } else {
          primary += 'P';
          secondary += 'P';
        }
        break;
      case 'Q':
        primary += 'K';
        secondary += 'K';
        break;
      case 'R':
        primary += 'R';
        secondary += 'R';
        break;
      case 'S':
        if (next === 'H') {
          primary += 'X';
          secondary += 'X';
          i++;
        } else {
          primary += 'S';
          secondary += 'S';
        }
        break;
      case 'T':
        if (next === 'H') {
          primary += '0';
          secondary += 'T';
          i++;
        } else {
          primary += 'T';
          secondary += 'T';
        }
        break;
      case 'V':
        primary += 'F';
        secondary += 'F';
        break;
      case 'W':
        if (isVowel(next)) {
          primary += 'A';
          secondary += 'F';
        }
        break;
      case 'X':
        primary += i === 0 ? 'S' : 'KS';
        secondary += i === 0 ? 'S' : 'KS';
        break;
      case 'Z':
        primary += 'S';
        secondary += 'S';
        break;
      default:
        break;
    }
    i++;
  }

  return [primary, secondary];
}

export function phoneticAlignmentScore(a: string, b: string): number {
  const [p1, s1] = doubleMetaphone(a);
  const [p2, s2] = doubleMetaphone(b);
  if (!p1 || !p2) return 0;

  if (p1 === p2 || p1 === s2 || s1 === p2 || s1 === s2) {
    return 1.0;
  }

  // Partial phonetic agreement via edit similarity on metaphone hashes
  const best = Math.max(
    normalizedLevenshtein(p1, p2),
    normalizedLevenshtein(p1, s2),
    normalizedLevenshtein(s1, p2),
    normalizedLevenshtein(s1, s2),
  );
  return best;
}

/**
 * Bayesian Clinical Prior Compatibility Phi(f_q, s_q, t_q, c_i) in [0, 1].
 * Rewards matching dosage form, milligram strength, and standard meal-timing schedule.
 */
export function clinicalPriorCompatibility(
  dosageForm: DosageForm | null,
  strengthMg: number | null,
  mealTiming: MealTiming | null,
  candidate: DgdaDrugRecord,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  // Dosage form prior (weight 0.35)
  if (dosageForm) {
    totalWeight += 0.35;
    if (candidate.dosageForm === dosageForm) {
      weightedSum += 0.35;
    } else if (
      (dosageForm === 'Tablet' && candidate.dosageForm === 'Capsule') ||
      (dosageForm === 'Capsule' && candidate.dosageForm === 'Tablet')
    ) {
      // Mild compatibility for oral solid dosage forms
      weightedSum += 0.12;
    }
  }

  // Milligram strength prior (weight 0.40)
  if (strengthMg !== null) {
    totalWeight += 0.4;
    const diffRatio = Math.abs(candidate.strengthMg - strengthMg) / Math.max(candidate.strengthMg, strengthMg, 1);
    if (diffRatio < 0.01) {
      weightedSum += 0.4;
    } else if (diffRatio <= 0.15) {
      weightedSum += 0.2;
    }
  }

  // Meal-timing therapeutic prior (weight 0.25)
  if (mealTiming) {
    totalWeight += 0.25;
    if (candidate.standardMealTiming === mealTiming) {
      weightedSum += 0.25;
    } else if (candidate.standardMealTiming === 'any') {
      weightedSum += 0.16;
    } else if (mealTiming === 'bedtime' && candidate.standardMealTiming === 'after_meal') {
      weightedSum += 0.1;
    }
  }

  if (totalWeight === 0) return 0.5; // Neutral prior when no metadata hints exist
  return Math.min(1, Math.max(0, weightedSum / totalWeight));
}

export function scoreDrugCandidate(
  rawQuery: string,
  candidate: DgdaDrugRecord,
  options?: {
    dosageFormHint?: string;
    strengthHint?: string;
    scheduleShorthand?: string;
  },
): ScoreBreakdown {
  const brandQuery = normalizeBrandQuery(rawQuery);
  const candidateBrand = candidate.brandName.toLowerCase();
  const candidateGeneric = candidate.activeGenericDisplay.toLowerCase();

  // Compare against brand name (primary) and active generic (fallback when doctor writes generic)
  const brandCosine = characterCosineSimilarity(brandQuery, candidateBrand);
  const genericCosine = characterCosineSimilarity(brandQuery, candidateGeneric) * 0.92;
  const denseCosine = Math.max(brandCosine, genericCosine);

  const brandLev = normalizedLevenshtein(brandQuery, candidateBrand);
  const genericLev = normalizedLevenshtein(brandQuery, candidateGeneric) * 0.92;
  const levenshteinNorm = Math.max(brandLev, genericLev);

  const brandPhon = phoneticAlignmentScore(brandQuery, candidateBrand);
  const genericPhon = phoneticAlignmentScore(brandQuery, candidateGeneric) * 0.9;
  const phoneticMatch = Math.max(brandPhon, genericPhon);

  const formHint = extractDosageFormHint(rawQuery, options?.dosageFormHint);
  const strengthHint = extractStrengthMgHint(rawQuery, options?.strengthHint);
  const mealHint = options?.scheduleShorthand
    ? extractMealTimingHint(options.scheduleShorthand)
    : null;

  const clinicalPrior = clinicalPriorCompatibility(
    formHint,
    strengthHint,
    mealHint,
    candidate,
  );

  // If textual similarity is extremely low across both lexical and phonetic measures,
  // cap clinical prior influence so a pure scribble cannot get inflated just by matching "Tab 500mg".
  const textSignal = 0.5 * denseCosine + 0.5 * levenshteinNorm;
  const gatedPrior = textSignal < 0.35 ? clinicalPrior * (textSignal / 0.35) : clinicalPrior;

  const totalScore =
    RANKING_WEIGHTS.alpha * denseCosine +
    RANKING_WEIGHTS.beta * levenshteinNorm +
    RANKING_WEIGHTS.gamma * phoneticMatch +
    RANKING_WEIGHTS.delta * gatedPrior;

  return {
    denseCosine: Number(denseCosine.toFixed(3)),
    levenshteinNorm: Number(levenshteinNorm.toFixed(3)),
    phoneticMatch: Number(phoneticMatch.toFixed(3)),
    clinicalPrior: Number(clinicalPrior.toFixed(3)),
    totalScore: Number(Math.min(0.99, totalScore).toFixed(2)),
    matchedHypothesis: rawQuery,
  };
}

/**
 * Resolves a VLM medication line containing top-3 visual transcription hypotheses
 * against the indexed DGDA database, returning ranked candidates & ambiguity state.
 */
export function resolveMedicationHypotheses(
  line: RawVlmMedicationLine,
  database: DgdaDrugRecord[] = DGDA_DRUG_DATABASE,
): {
  bestCandidate: CandidateMatch;
  topCandidates: CandidateMatch[];
  requiresHumanVerification: boolean;
} {
  const orderedQueries = Array.from(
    new Set([line.ocrRaw, ...(line.hypotheses ?? [])].filter((q) => q && q.trim().length > 0)),
  );

  // Primary OCR reading gets full weight; secondary VLM hypotheses receive mild rank decay
  // so an exact primary match (e.g. Naprosyn) always outranks a look-alike fallback (e.g. Napa),
  // while a corrupted primary scribble (e.g. Srgel) still resolves cleanly to hypothesis #2 (Sergel).
  const rankMultipliers = [1.0, 0.97, 0.93, 0.89];

  const candidateMap = new Map<string, CandidateMatch>();

  for (const drug of database) {
    let bestForDrug: ScoreBreakdown | null = null;
    orderedQueries.forEach((q, idx) => {
      const rawBreakdown = scoreDrugCandidate(q, drug, {
        dosageFormHint: line.dosageFormHint,
        strengthHint: line.strengthHint,
        scheduleShorthand: line.scheduleShorthand,
      });
      const rankWeight = rankMultipliers[Math.min(idx, rankMultipliers.length - 1)];
      const weightedTotal = Number(Math.min(0.99, rawBreakdown.totalScore * rankWeight).toFixed(2));
      const breakdown: ScoreBreakdown = {
        ...rawBreakdown,
        totalScore: weightedTotal,
      };
      if (!bestForDrug || breakdown.totalScore > bestForDrug.totalScore) {
        bestForDrug = breakdown;
      }
    });
    if (bestForDrug) {
      candidateMap.set(drug.id, { drug, breakdown: bestForDrug });
    }
  }

  const ranked = Array.from(candidateMap.values()).sort(
    (a, b) => b.breakdown.totalScore - a.breakdown.totalScore,
  );

  const topCandidates = ranked.slice(0, 4);
  const bestCandidate = topCandidates[0];
  const requiresHumanVerification =
    !bestCandidate || bestCandidate.breakdown.totalScore < AMBIGUITY_THRESHOLD;

  return {
    bestCandidate,
    topCandidates,
    requiresHumanVerification,
  };
}

/**
 * Live interactive DGDA search using the exact Stage 3 hybrid scoring equation.
 */
export function searchDgdaHybrid(
  query: string,
  options?: {
    dosageFormHint?: string;
    strengthHint?: string;
    scheduleShorthand?: string;
    limit?: number;
  },
  database: DgdaDrugRecord[] = DGDA_DRUG_DATABASE,
): CandidateMatch[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return database.slice(0, options?.limit ?? 15).map((drug) => ({
      drug,
      breakdown: {
        denseCosine: 1,
        levenshteinNorm: 1,
        phoneticMatch: 1,
        clinicalPrior: 1,
        totalScore: 1,
        matchedHypothesis: drug.brandName,
      },
    }));
  }

  const scored = database.map((drug) => ({
    drug,
    breakdown: scoreDrugCandidate(trimmed, drug, options),
  }));

  return scored
    .sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore)
    .slice(0, options?.limit ?? 12);
}
