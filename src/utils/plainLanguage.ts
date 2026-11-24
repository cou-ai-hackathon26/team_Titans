import type {
  BlisterVerificationResult,
  ClinicalAlert,
  ComorbidityId,
  DecodedMedication,
} from '../types/clinical';

export const SIMPLE_CONDITION_LABELS: Record<ComorbidityId, { en: string; bn: string }> = {
  CKD: { en: 'Kidney disease', bn: 'কিডনি রোগ' },
  PREGNANCY: { en: 'Pregnancy', bn: 'গর্ভাবস্থা' },
  DIABETES: { en: 'Diabetes', bn: 'ডায়াবেটিস' },
  HYPERTENSION: { en: 'High blood pressure', bn: 'উচ্চ রক্তচাপ' },
  PEDIATRIC: { en: 'Child (under 12)', bn: 'শিশু (১২ বছরের কম)' },
  HEPATIC: { en: 'Liver disease', bn: 'লিভার রোগ' },
  ASTHMA: { en: 'Asthma', bn: 'অ্যাজমা' },
  GASTRIC_ULCER: { en: 'Stomach ulcer', bn: 'গ্যাস্ট্রিক আলসার' },
};

export function getSimpleConditionLabel(id: ComorbidityId, lang: 'en' | 'bn'): string {
  return lang === 'bn' ? SIMPLE_CONDITION_LABELS[id].bn : SIMPLE_CONDITION_LABELS[id].en;
}

export function getPlainAlertTitle(alert: ClinicalAlert, lang: 'en' | 'bn'): string {
  if (alert.alertType === 'DUPLICATE_GENERIC') {
    if (alert.isCrossVisit) {
      return lang === 'bn' ? 'দুই ভিজিটে একই ওষুধ' : 'Same medicine across visits';
    }
    return lang === 'bn' ? 'একই ওষুধ দুবার' : 'Same medicine twice';
  }
  if (alert.alertType === 'DRUG_DRUG_INTERACTION') {
    if (alert.isCrossVisit) {
      return lang === 'bn' ? 'দুই ভিজিটের ওষুধের সংঘর্ষ' : 'Unsafe mix across visits';
    }
    return lang === 'bn' ? 'একসাথে খাওয়া ঝুঁকিপূর্ণ' : 'Unsafe combination';
  }
  return lang === 'bn' ? 'স্বাস্থ্য সতর্কতা' : 'Health warning';
}

export function getPlainAlertMessage(alert: ClinicalAlert, lang: 'en' | 'bn'): string {
  if (lang === 'bn') {
    return alert.banglaReason
      .replace(/^\[([^\]]+)\]\s*/, '$1: ')
      .replace(/\s*\((?:CKD|HTN|DM)\)/g, '');
  }

  let msg = alert.clinicalReason
    .replace(/^\[([^\]]+)\]\s*/, '')
    .replace(
      /Silent duplicate active generic detected:\s*/i,
      'These two brands contain the exact same medicine — ',
    )
    .replace(
      /Co-prescribing NSAIDs \(([^)]+)\) with ARBs \(([^)]+)\) impairs renal afferent\/efferent autoregulation, risking acute kidney injury and reduced blood pressure control\./i,
      'Taking this painkiller ($1) with blood pressure medicine ($2) can harm your kidneys and make blood pressure harder to control.',
    )
    .replace(
      /NSAIDs pose severe acute kidney injury risk in CKD Stage 3\+ patients by constricting afferent renal arterioles\./i,
      'Painkillers like this can seriously harm weak kidneys. Ask your doctor for a safer option.',
    )
    .replace(
      /Regular NSAID use causes sodium retention and elevates systolic blood pressure in hypertensive patients\./i,
      'Regular use of this painkiller can raise your blood pressure.',
    )
    .replace(
      /Omeprazole inhibits CYP2C19 activation of Clopidogrel[^.]*\./i,
      'This stomach medicine can weaken your heart blood thinner. Ask your doctor before taking both together.',
    )
    .replace(
      /Fluoroquinolones[^.]*cartilage[^.]*\./i,
      'This antibiotic is not safe during pregnancy. Please consult your doctor immediately.',
    )
    .replace(
      /ARBs and ACE inhibitors cause fetal renal toxicity[^.]*\./i,
      'This blood pressure medicine is unsafe during pregnancy. Contact your doctor right away.',
    )
    .replace(
      /NSAIDs in pregnancy[^.]*\./i,
      'This painkiller is risky during pregnancy. Please check with your doctor before taking it.',
    );

  // Strip technical words if any remain
  msg = msg.replace(/\bNSAIDs?\b/g, 'painkillers').replace(/\bARBs?\b/g, 'blood pressure pills');
  return msg;
}

export function getPlainScheduleLine(med: DecodedMedication, lang: 'en' | 'bn'): string {
  if (lang === 'bn') {
    return med.compiledSchedule.banglaVoiceText;
  }

  const s = med.compiledSchedule;
  const times: string[] = [];
  if (s.morning > 0) times.push(`Morning (${s.morning})`);
  if (s.noon > 0) times.push(`Noon (${s.noon})`);
  if (s.night > 0) times.push(`Night (${s.night})`);

  const when = s.asNeeded ? 'Only when needed' : times.join(' · ') || 'As directed';
  const mealMap: Record<typeof s.mealTiming, string> = {
    before_meal: s.mealOffsetMinutes
      ? `${s.mealOffsetMinutes} min before food`
      : 'before food',
    after_meal: 'after food',
    with_meal: 'with food',
    bedtime: 'at bedtime',
    any: 'anytime',
  };
  const mealText = mealMap[s.mealTiming];
  return `${when} · ${mealText} · ${s.durationDays} days`;
}

export function getPlainBlisterTitle(
  status: BlisterVerificationResult['status'],
  lang: 'en' | 'bn',
): string {
  if (status === 'UNREADABLE_FOIL') {
    return lang === 'bn'
      ? 'পাতার লেখা পড়া যাচ্ছে না — হাতে মিলিয়ে নিন'
      : 'Strip unreadable — manual check needed';
  }
  if (status === 'CRITICAL_MISMATCH') {
    return lang === 'bn'
      ? 'ভুল ওষুধ বা মাত্রা — খাবেন না'
      : 'Wrong medicine or dose — do not take';
  }
  if (status === 'BIO_EQUIVALENT') {
    return lang === 'bn'
      ? 'ভিন্ন ব্র্যান্ড, একই ওষুধ'
      : 'Different brand, same medicine';
  }
  return lang === 'bn'
    ? 'প্রেসক্রিপশনের সাথে মিলেছে'
    : 'Matches your prescription';
}

export function getPlainBlisterMessage(
  check: BlisterVerificationResult,
  lang: 'en' | 'bn',
): string {
  if (lang === 'bn') return check.alertBangla;
  if (check.status === 'UNREADABLE_FOIL') {
    const why = check.abstentionReason ? ` (${check.abstentionReason})` : '';
    return `This strip is too cropped, damaged, or glare-washed to read reliably${why}. We held back the red warning to avoid a false alarm — please check the full box or retake the photo in clear lighting.`;
  }
  if (check.status === 'EXACT_MATCH') {
    return `This strip (${check.dispensedOnStrip}) matches what your doctor prescribed.`;
  }
  if (check.status === 'BIO_EQUIVALENT') {
    return `Your doctor wrote ${check.prescribedItem}. The pharmacy gave ${check.dispensedOnStrip}, which has the exact same active medicine and strength.`;
  }
  return check.reasonEnglish
    .replace('Wrong strength dispensed! Prescription specifies', 'Wrong dose! Your doctor wrote')
    .replace('but the physical blister strip contains', 'but this strip is')
    .replace(
      'Unprescribed drug mismatch! Physical strip',
      'This medicine strip',
    )
    .replace(
      'does not match any active molecule on the decoded prescription.',
      'is not on your prescription. Please return it to the pharmacy.',
    );
}
