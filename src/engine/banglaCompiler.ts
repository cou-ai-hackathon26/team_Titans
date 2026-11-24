import type {
  CompiledSchedule,
  DecodedMedication,
  DgdaDrugRecord,
  DosageForm,
  MealTiming,
} from '../types/clinical';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}

function formatBanglaDoseQuantity(qty: number): string {
  if (qty === 0.5) return 'আধা';
  if (qty === 1.5) return 'দেড়';
  if (Number.isInteger(qty)) return toBanglaDigits(qty);
  return toBanglaDigits(qty);
}

function getBanglaDosageUnit(form: DosageForm, isTeaspoon: boolean): string {
  if (isTeaspoon) return 'চা চামচ';
  switch (form) {
    case 'Capsule':
      return 'ক্যাপসুল';
    case 'Tablet':
      return 'ট্যাবলেট';
    case 'Syrup':
    case 'Suspension':
      return 'চা চামচ সিরাপ';
    case 'Drops':
      return 'ফোঁটা';
    case 'Inhaler':
      return 'পাফ';
    case 'Injection':
      return 'ইনজেকশন';
    case 'Gel':
      return 'বার প্রলেপ';
  }
}

function formatStrengthBangla(strengthText: string): string {
  return toBanglaDigits(strengthText)
    .replace(/mg/gi, ' মিলিগ্রাম')
    .replace(/mcg/gi, ' মাইক্রোগ্রাম')
    .replace(/ml/gi, ' মিলি')
    .replace(/IU/gi, ' আইইউ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFractionToken(token: string): number {
  const clean = token.trim();
  if (clean === '1/2' || clean === '½') return 0.5;
  if (clean === '1/4' || clean === '¼') return 0.25;
  if (clean === '3/4' || clean === '¾') return 0.75;
  if (clean === '1.5' || clean === '1½') return 1.5;
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Deterministic Bangladeshi clinical shorthand grammar compiler (Stage 6).
 * Zero LLM hallucination — maps shorthand directly into structured Morning/Noon/Night
 * counts and natural spoken Bangla instructions.
 */
export function compileBanglaSchedule(
  drug: DgdaDrugRecord,
  shorthandRaw: string,
  explicitDurationDays?: number,
): CompiledSchedule {
  const raw = (shorthandRaw || '1+0+1 p/c').trim();
  const lower = raw.toLowerCase();

  let morning = 0;
  let noon = 0;
  let night = 0;
  let asNeeded = false;

  const isTeaspoon = /\bt\/s\b|\btsp\b|teaspoon/.test(lower);

  // 1. Parse explicit X+Y+Z Bangladeshi shorthand (supports fractions like 1/2+0+1/2)
  const tripleMatch = raw.match(
    /(\d+(?:\.\d+)?|\d+\/\d+|½)\s*\+\s*(\d+(?:\.\d+)?|\d+\/\d+|½)\s*\+\s*(\d+(?:\.\d+)?|\d+\/\d+|½)/,
  );

  if (tripleMatch) {
    morning = parseFractionToken(tripleMatch[1]);
    noon = parseFractionToken(tripleMatch[2]);
    night = parseFractionToken(tripleMatch[3]);
  } else if (/\bsos\b|prn|as\s*needed/.test(lower)) {
    asNeeded = true;
    morning = 0;
    noon = 0;
    night = 0;
  } else if (/\btds\b|\btid\b/.test(lower)) {
    morning = 1;
    noon = 1;
    night = 1;
  } else if (/\bbd\b|\bbid\b/.test(lower)) {
    morning = 1;
    noon = 0;
    night = 1;
  } else if (/\bhs\b|bedtime|night/.test(lower)) {
    morning = 0;
    noon = 0;
    night = 1;
  } else if (/\bqid\b/.test(lower)) {
    morning = 1;
    noon = 2;
    night = 1;
  } else if (/\bod\b|once\s*daily/.test(lower)) {
    morning = 1;
    noon = 0;
    night = 0;
  } else {
    // Fallback to safe 1+0+1 default if unparseable
    morning = 1;
    noon = 0;
    night = 1;
  }

  if (/\bsos\b|prn/.test(lower)) {
    asNeeded = true;
  }

  // 2. Parse meal timing relation
  let mealTiming: MealTiming = drug.standardMealTiming;
  if (/\ba\/c\b|before\s*meal|empty\s*stomach/.test(lower)) {
    mealTiming = 'before_meal';
  } else if (/\bp\/c\b|after\s*meal/.test(lower)) {
    mealTiming = 'after_meal';
  } else if (/with\s*meal/.test(lower)) {
    mealTiming = 'with_meal';
  } else if (/\bhs\b|bedtime/.test(lower)) {
    mealTiming = 'bedtime';
  }

  // 3. Parse meal offset minutes (e.g. "a/c 30m" or "30 min")
  const offsetMatch = lower.match(/(\d+)\s*(?:m|min|mins|minutes)\b/);
  const mealOffsetMinutes = offsetMatch ? parseInt(offsetMatch[1], 10) : undefined;

  // 4. Parse duration days (e.g., "for 14 days", "7d", "1 month", "2 weeks")
  let durationDays = explicitDurationDays ?? 7;
  const dayMatch = lower.match(/(?:for\s*|x\s*)?(\d+)\s*(?:days|day|d)\b/);
  const weekMatch = lower.match(/(?:for\s*|x\s*)?(\d+)\s*(?:weeks|week|w)\b/);
  const monthMatch = lower.match(/(?:for\s*|x\s*)?(\d+)\s*(?:months|month|mo)\b/);

  if (dayMatch) {
    durationDays = parseInt(dayMatch[1], 10);
  } else if (weekMatch) {
    durationDays = parseInt(weekMatch[1], 10) * 7;
  } else if (monthMatch) {
    durationDays = parseInt(monthMatch[1], 10) * 30;
  } else if (/cont\.?|continue|চলবে/.test(lower)) {
    durationDays = 30;
  }

  durationDays = Math.max(1, Math.min(90, durationDays));

  // 5. Compute daily & total units
  const dailyUnits = asNeeded && morning + noon + night === 0 ? 1 : morning + noon + night;
  const totalUnits =
    drug.dosageForm === 'Syrup' || drug.dosageForm === 'Suspension' || drug.dosageForm === 'Inhaler'
      ? 1
      : Math.ceil(dailyUnits * durationDays);

  // 6. Build deterministic Bangla sentence
  const banglaBrand = `${drug.banglaName} ${formatStrengthBangla(drug.strengthText)}`;
  const unitBn = getBanglaDosageUnit(drug.dosageForm, isTeaspoon);

  const timePartsBn: string[] = [];
  if (morning > 0) timePartsBn.push('সকালে');
  if (noon > 0) timePartsBn.push('দুপুরে');
  if (night > 0) timePartsBn.push('রাতে');

  let timeClauseBn = '';
  if (asNeeded && timePartsBn.length === 0) {
    timeClauseBn = 'প্রয়োজনে (ব্যথা বা জ্বর হলে)';
  } else if (timePartsBn.length === 1) {
    timeClauseBn = timePartsBn[0];
  } else if (timePartsBn.length === 2) {
    timeClauseBn = `${timePartsBn[0]} ও ${timePartsBn[1]}`;
  } else if (timePartsBn.length === 3) {
    timeClauseBn = 'সকালে, দুপুরে ও রাতে';
  }

  let mealClauseBn = '';
  if (mealTiming === 'before_meal') {
    mealClauseBn = mealOffsetMinutes
      ? `খাবারের ${toBanglaDigits(mealOffsetMinutes)} মিনিট আগে`
      : 'খাবারের আগে';
  } else if (mealTiming === 'after_meal') {
    mealClauseBn = 'ভরা পেটে খাবারের পরে';
  } else if (mealTiming === 'with_meal') {
    mealClauseBn = 'খাবারের সাথে';
  } else if (mealTiming === 'bedtime') {
    mealClauseBn = timePartsBn.includes('রাতে') ? 'ঘুমানোর আগে' : 'রাতে ঘুমানোর আগে';
  } else {
    mealClauseBn = 'যেকোনো সময়';
  }

  const activeCounts = [morning, noon, night].filter((c) => c > 0);
  const allEqual = activeCounts.length > 0 && activeCounts.every((c) => c === activeCounts[0]);
  const doseQty = activeCounts[0] ?? 1;

  let quantityClauseBn = '';
  if (asNeeded && activeCounts.length === 0) {
    quantityClauseBn = isTeaspoon ? `১ ${unitBn}` : `১টি ${unitBn}`;
  } else if (allEqual) {
    const qtyStr = formatBanglaDoseQuantity(doseQty);
    quantityClauseBn = isTeaspoon
      ? `${qtyStr} ${unitBn} করে`
      : `${qtyStr}টি করে ${unitBn}`;
  } else {
    const detailed: string[] = [];
    if (morning > 0) detailed.push(`সকালে ${formatBanglaDoseQuantity(morning)}টি`);
    if (noon > 0) detailed.push(`দুপুরে ${formatBanglaDoseQuantity(noon)}টি`);
    if (night > 0) detailed.push(`রাতে ${formatBanglaDoseQuantity(night)}টি`);
    quantityClauseBn = `${detailed.join(', ')} ${unitBn}`;
    timeClauseBn = '';
  }

  const durationClauseBn = explicitDurationDays || dayMatch || weekMatch || monthMatch
    ? ` (${toBanglaDigits(durationDays)} দিন)`
    : '';

  const sentencePieces = [timeClauseBn, mealClauseBn, quantityClauseBn, 'খাবেন।'].filter(Boolean);
  const banglaVoiceText = `${banglaBrand}: ${sentencePieces.join(' ')}${durationClauseBn}`;

  const mealLabelEn =
    mealTiming === 'before_meal'
      ? mealOffsetMinutes
        ? `${mealOffsetMinutes}m before meals`
        : 'Before meals (a/c)'
      : mealTiming === 'after_meal'
        ? 'After meals (p/c)'
        : mealTiming === 'bedtime'
          ? 'At bedtime (HS)'
          : mealTiming === 'with_meal'
            ? 'With meals'
            : 'Any time';

  const shorthandNormalized = asNeeded && morning + noon + night === 0
    ? `SOS ${mealTiming === 'after_meal' ? 'p/c' : ''}`.trim()
    : `${morning}+${noon}+${night}${mealTiming === 'before_meal' ? ' a/c' : mealTiming === 'after_meal' ? ' p/c' : mealTiming === 'bedtime' ? ' HS' : ''}${mealOffsetMinutes ? ` ${mealOffsetMinutes}m` : ''}`;

  const englishInstruction = asNeeded && morning + noon + night === 0
    ? `Take 1 ${drug.dosageForm.toLowerCase()} as needed (${mealLabelEn}) for up to ${durationDays} days.`
    : `Take ${morning}-${noon}-${night} (Morning-Noon-Night), ${mealLabelEn}, for ${durationDays} days.`;

  return {
    morning,
    noon,
    night,
    asNeeded,
    mealTiming,
    mealOffsetMinutes,
    durationDays,
    dailyUnits,
    totalUnits,
    englishInstruction,
    banglaVoiceText,
    banglaTimingLabel: mealClauseBn,
    shorthandNormalized,
  };
}

/**
 * Generates a formatted WhatsApp-ready bilingual medication schedule card
 * for elderly caregivers and family members in Bangladesh.
 */
export function buildWhatsAppCaregiverMessage(
  prescriptionId: string,
  patientName: string | undefined,
  medications: DecodedMedication[],
  totalMrpBdt: number,
): string {
  const header = `OshudhGuard AI — ওষুধ খাওয়ার নিয়মাবলী (${prescriptionId})`;
  const patientLine = patientName ? `রোগী: ${patientName}` : 'রোগীর দৈনিক ওষুধের তালিকা';

  const lines = medications.map((med, idx) => {
    const s = med.compiledSchedule;
    const slots = [
      s.morning > 0 ? `সকাল: ${toBanglaDigits(s.morning)}` : null,
      s.noon > 0 ? `দুপুর: ${toBanglaDigits(s.noon)}` : null,
      s.night > 0 ? `রাত: ${toBanglaDigits(s.night)}` : null,
      s.asNeeded ? 'প্রয়োজনে (SOS)' : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return `${toBanglaDigits(idx + 1)}. ${med.resolvedDrug.brandName} ${med.resolvedDrug.strengthText} (${med.resolvedDrug.activeGenericDisplay})\n   ${s.banglaVoiceText}\n   [${slots} • ${toBanglaDigits(s.durationDays)} দিন]`;
  });

  const footer = `\nসরকারি DGDA সর্বোচ্চ মূল্য (আনুমানিক): ৳${toBanglaDigits(totalMrpBdt.toFixed(0))}\nসতর্কতা: যেকোনো ডোজ পরিবর্তনের আগে চিকিৎসক বা রেজিস্টার্ড ফার্মাসিস্টের পরামর্শ নিন।`;

  return [header, patientLine, '', ...lines, footer].join('\n');
}
