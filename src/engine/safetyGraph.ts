import {
  COMORBIDITY_CONTRAINDICATIONS,
  COMORBIDITY_METADATA,
  DDI_GRAPH_EDGES,
  MOLECULE_NODES,
} from '../data/clinicalGraph';
import { DGDA_DRUG_DATABASE, formatDrugLabel } from '../data/dgdaDatabase';
import { toBanglaDigits } from './banglaCompiler';
import { scoreDrugCandidate } from './grounding';
import type {
  BioEquivalentOption,
  BlisterReadability,
  BlisterVerificationResult,
  ClinicalAlert,
  ComorbidityId,
  DecodedMedication,
  DgdaDrugRecord,
  MedicationPriceRow,
  PatientContext,
  PrescriptionPipelinePayload,
  PrescriptionVisit,
  PriceTransparencyReport,
} from '../types/clinical';

export const BLISTER_MIN_READABILITY_SCORE = 0.62;
export const BLISTER_MIN_OCR_CONFIDENCE = 0.55;
export const BLISTER_DAMAGED_GROUNDING_THRESHOLD = 0.74;

export interface SafetyGraphEdgeTrace {
  id: string;
  sourceLabel: string;
  relation: string;
  targetLabel: string;
  severity: 'HIGH' | 'MODERATE' | 'SAFE';
  isCrossVisit?: boolean;
}

function formatVisitTag(med: DecodedMedication): string {
  if (med.visitLabel && med.visitDate) {
    return `${med.visitLabel} · ${med.visitDate}`;
  }
  return med.visitLabel || med.visitDate || 'Current Visit';
}

export function buildSafetyGraphTrace(
  medications: DecodedMedication[],
  alerts: ClinicalAlert[],
): {
  moleculeCount: number;
  resolvedNodes: Array<{
    brand: string;
    molecules: string[];
    therapeuticClass: string;
    visitLabel?: string;
  }>;
  conflictEdges: SafetyGraphEdgeTrace[];
} {
  const uniqueMolecules = new Set<string>();
  const resolvedNodes = medications.map((med) => {
    const names = med.resolvedDrug.activeMoleculeIds.map((id) => {
      uniqueMolecules.add(id);
      return MOLECULE_NODES[id]?.canonicalName ?? id;
    });
    return {
      brand: `${med.resolvedDrug.brandName} ${med.resolvedDrug.strengthText}`,
      molecules: names,
      therapeuticClass: med.resolvedDrug.therapeuticClass,
      visitLabel: med.visitLabel,
    };
  });

  const conflictEdges: SafetyGraphEdgeTrace[] = alerts.map((alert) => {
    const crossPrefix = alert.isCrossVisit ? 'CROSS-VISIT ' : '';
    if (alert.alertType === 'DUPLICATE_GENERIC') {
      return {
        id: alert.id,
        sourceLabel: alert.relatedDrugs[0] ?? alert.drugInvolved,
        relation: `${crossPrefix}SAME MOLECULE (${alert.activeMolecule ?? 'Shared Generic'})`,
        targetLabel: alert.relatedDrugs[1] ?? alert.drugInvolved,
        severity: 'HIGH',
        isCrossVisit: alert.isCrossVisit,
      };
    }
    if (alert.alertType === 'DRUG_DRUG_INTERACTION') {
      return {
        id: alert.id,
        sourceLabel: alert.relatedDrugs[0] ?? alert.drugInvolved,
        relation: `${crossPrefix}DDI INTERACTION`,
        targetLabel: alert.relatedDrugs[1] ?? alert.drugInvolved,
        severity: alert.severity === 'HIGH' ? 'HIGH' : 'MODERATE',
        isCrossVisit: alert.isCrossVisit,
      };
    }
    const conditionMatch = alert.clinicalReason.match(/^\[([^\]]+)\]/);
    return {
      id: alert.id,
      sourceLabel: alert.drugInvolved,
      relation: 'CONTRAINDICATED IN',
      targetLabel: conditionMatch ? conditionMatch[1] : 'Active Comorbidity',
      severity: alert.severity === 'HIGH' ? 'HIGH' : 'MODERATE',
    };
  });

  return {
    moleculeCount: uniqueMolecules.size,
    resolvedNodes,
    conflictEdges,
  };
}

/**
 * Infers structured ComorbidityIds from Zone A free-text diagnosis notes
 * (e.g., "CKD Stage 3", "HTN", "T2DM", "Pregnancy 2nd Trimester").
 */
export function detectComorbiditiesFromNotes(notes: string[]): ComorbidityId[] {
  const joined = notes.join(' ').toLowerCase();
  const detected = new Set<ComorbidityId>();

  (Object.keys(COMORBIDITY_METADATA) as ComorbidityId[]).forEach((id) => {
    const keywords = COMORBIDITY_METADATA[id].keywords;
    if (keywords.some((kw) => joined.includes(kw))) {
      detected.add(id);
    }
  });

  return Array.from(detected);
}

/**
 * Stage 5: Clinical Graph-RAG & Deterministic Safety Audit (Single-Visit & Cross-Visit).
 * 1. Duplicate Active Generic Detection: Generic(c_a) ∩ Generic(c_b) != ∅ (within & across clinics/visits)
 * 2. Drug-Drug Interaction (DDI) Graph Traversal over G = (V, E) (within & across clinics/visits)
 * 3. Comorbidity Contraindications against Zone A + user toggles
 */
export function runClinicalSafetyAudit(
  medications: DecodedMedication[],
  activeComorbidities: ComorbidityId[],
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const seenKeys = new Set<string>();

  // 1. Duplicate Active Generic Detection (same-visit & cross-visit)
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const medA = medications[i];
      const medB = medications[j];
      const drugA = medA.resolvedDrug;
      const drugB = medB.resolvedDrug;

      const sharedMolecules = drugA.activeMoleculeIds.filter((mol) =>
        drugB.activeMoleculeIds.includes(mol),
      );

      if (sharedMolecules.length > 0) {
        const isCrossVisit = Boolean(
          medA.visitId && medB.visitId && medA.visitId !== medB.visitId,
        );
        const pairKey = [
          `${medA.visitId ?? 'v0'}:${drugA.id}`,
          `${medB.visitId ?? 'v0'}:${drugB.id}`,
        ]
          .sort()
          .join('|');
        const key = `dup:${pairKey}:${sharedMolecules.join(',')}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const molNames = sharedMolecules
          .map((m) => MOLECULE_NODES[m]?.canonicalName ?? m)
          .join(' + ');
        const molNamesBn = sharedMolecules
          .map((m) => MOLECULE_NODES[m]?.banglaName ?? m)
          .join(' ও ');

        const labelA = `${drugA.brandName} ${drugA.strengthText}`;
        const labelB = `${drugB.brandName} ${drugB.strengthText}`;
        const visitA = formatVisitTag(medA);
        const visitB = formatVisitTag(medB);

        alerts.push({
          id: key,
          alertType: 'DUPLICATE_GENERIC',
          severity: 'HIGH',
          drugInvolved: isCrossVisit
            ? `${labelA} [${visitA}] + ${labelB} [${visitB}] (${molNames})`
            : `${labelA} + ${labelB} (${molNames})`,
          relatedDrugs: isCrossVisit
            ? [`${labelA} [${visitA}]`, `${labelB} [${visitB}]`]
            : [labelA, labelB],
          activeMolecule: molNames,
          isCrossVisit,
          visitsInvolved: isCrossVisit ? [visitA, visitB] : undefined,
          clinicalReason: isCrossVisit
            ? `Cross-Visit Conflict: ${labelA} [${visitA}] duplicates ${labelB} [${visitB}] — both contain ${molNames}. Taking both across visits causes accidental double dosing.`
            : `Silent duplicate active generic detected: both ${labelA} (${drugA.manufacturer}) and ${labelB} (${drugB.manufacturer}) contain ${molNames}. Taking both causes accidental double dosing.`,
          banglaReason: isCrossVisit
            ? `দুই ভিজিটের ওষুধের সংঘর্ষ! ${drugA.banglaName} [${visitA}] এবং ${drugB.banglaName} [${visitB}] — দুটিতেই একই জেনেরিক (${molNamesBn}) রয়েছে। একসাথে খেলে ওভারডোজ হতে পারে।`
            : `সতর্কতা! ${drugA.banglaName} এবং ${drugB.banglaName} — দুটি ওষুধে একই জেনেরিক (${molNamesBn}) রয়েছে। একসাথে খেলে ওভারডোজ হতে পারে।`,
          recommendation: isCrossVisit
            ? 'Show both clinic prescriptions to your doctor or pharmacist before taking both medicines.'
            : 'Do not take both brands concurrently. Confirm with physician which single brand to continue.',
        });
      }
    }
  }

  // 2. Drug-Drug Interaction (DDI) Graph Traversal (same-visit & cross-visit)
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const medA = medications[i];
      const medB = medications[j];
      const drugA = medA.resolvedDrug;
      const drugB = medB.resolvedDrug;

      for (const edge of DDI_GRAPH_EDGES) {
        const forward =
          drugA.activeMoleculeIds.includes(edge.moleculeA) &&
          drugB.activeMoleculeIds.includes(edge.moleculeB);
        const reverse =
          drugA.activeMoleculeIds.includes(edge.moleculeB) &&
          drugB.activeMoleculeIds.includes(edge.moleculeA);

        if (forward || reverse) {
          const isCrossVisit = Boolean(
            medA.visitId && medB.visitId && medA.visitId !== medB.visitId,
          );
          const pairKey = [
            `${medA.visitId ?? 'v0'}:${drugA.id}`,
            `${medB.visitId ?? 'v0'}:${drugB.id}`,
          ]
            .sort()
            .join('|');
          const key = `ddi:${edge.id}:${pairKey}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const labelA = `${drugA.brandName} ${drugA.strengthText}`;
          const labelB = `${drugB.brandName} ${drugB.strengthText}`;
          const visitA = formatVisitTag(medA);
          const visitB = formatVisitTag(medB);

          alerts.push({
            id: key,
            alertType: 'DRUG_DRUG_INTERACTION',
            severity: edge.severity,
            drugInvolved: isCrossVisit
              ? `${labelA} [${visitA}] + ${labelB} [${visitB}]`
              : `${labelA} + ${labelB}`,
            relatedDrugs: isCrossVisit
              ? [`${labelA} [${visitA}]`, `${labelB} [${visitB}]`]
              : [labelA, labelB],
            isCrossVisit,
            visitsInvolved: isCrossVisit ? [visitA, visitB] : undefined,
            clinicalReason: isCrossVisit
              ? `Cross-Visit Interaction (${labelA} [${visitA}] + ${labelB} [${visitB}]): ${edge.clinicalReason}`
              : edge.clinicalReason,
            banglaReason: isCrossVisit
              ? `দুই ভিজিটের ওষুধের ঝুঁকি (${visitA} ও ${visitB}): ${edge.banglaReason}`
              : edge.banglaReason,
            recommendation: edge.recommendation,
          });
        }
      }
    }
  }

  // 3. Comorbidity Contraindication Audit
  for (const comorbidity of activeComorbidities) {
    const rules = COMORBIDITY_CONTRAINDICATIONS.filter((r) => r.comorbidity === comorbidity);
    for (const med of medications) {
      const drug = med.resolvedDrug;
      for (const rule of rules) {
        const matchedMol = drug.activeMoleculeIds.find((m) => rule.molecules.includes(m));
        if (matchedMol) {
          const key = `cm:${comorbidity}:${drug.id}:${rule.id}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const molName = MOLECULE_NODES[matchedMol]?.canonicalName ?? drug.activeGenericDisplay;
          const visitTag = med.visitLabel ? ` [${formatVisitTag(med)}]` : '';
          alerts.push({
            id: key,
            alertType: 'COMORBIDITY_CONTRAINDICATION',
            severity: rule.severity,
            drugInvolved: `${drug.brandName} ${drug.strengthText}${visitTag} (${molName})`,
            relatedDrugs: [`${drug.brandName} ${drug.strengthText}`],
            activeMolecule: molName,
            clinicalReason: `[${COMORBIDITY_METADATA[comorbidity].labelEn}] ${rule.clinicalReason}`,
            banglaReason: `[${COMORBIDITY_METADATA[comorbidity].labelBn}] ${rule.banglaReason}`,
            recommendation: rule.recommendation,
          });
        }
      }
    }
  }

  // Sort HIGH alerts first, with cross-visit conflicts highlighted prominently within same severity
  const severityOrder = { HIGH: 0, MODERATE: 1, LOW: 2 };
  return alerts.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return Number(Boolean(b.isCrossVisit)) - Number(Boolean(a.isCrossVisit));
  });
}

/**
 * Evaluates raw blister OCR text for severe fragmentation, scissor-cut truncation,
 * or corruption markers that indicate an unreadable metallic foil imprint.
 */
function detectRawTextIllegibility(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return 'blank or completely washed out by glare';
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('unreadable') ||
    lower.includes('illegible') ||
    lower.includes('[cut]') ||
    lower.includes('damaged foil')
  ) {
    return 'marked illegible due to foil damage or glare';
  }

  const alphaChars = trimmed.replace(/[^a-z0-9]/gi, '');
  if (alphaChars.length < 3) {
    return 'too cropped or cut off to read the medicine name';
  }

  const noiseCount = (trimmed.match(/[?*#~_…]/g) ?? []).length;
  const dotRuns = (trimmed.match(/\.{2,}/g) ?? []).length;
  if (noiseCount >= 2 || (dotRuns >= 2 && alphaChars.length < 7)) {
    return 'fragmented by scissor cut, crumpling, or glare';
  }

  return null;
}

/**
 * Stage 4: Physical Blister-Strip Bipartite Verification against Prescribed Set C_Rx
 * with Uncertainty Abstention Gate for damaged, cropped, or glare-obscured foils.
 * Classifies each dispensed strip into:
 * - UNREADABLE_FOIL (Neutral Slate/Amber — Red mismatch alert withheld to prevent false alarm)
 * - EXACT_MATCH (Green)
 * - BIO_EQUIVALENT (Amber)
 * - CRITICAL_MISMATCH (Red + Bangla Voice Alert — ONLY when foil imprint is clearly readable!)
 */
export function verifyBlisterAgainstPrescription(
  ocrStripRaw: string,
  prescribedMeds: DecodedMedication[],
  options?: {
    stripId?: string;
    dosageFormHint?: string;
    strengthHint?: string;
    stripImageDataUrl?: string;
    claheImageDataUrl?: string;
    readability?: BlisterReadability;
    readabilityReason?: string;
    isCroppedOrDamaged?: boolean;
    ocrConfidence?: number;
  },
  database: DgdaDrugRecord[] = DGDA_DRUG_DATABASE,
): BlisterVerificationResult {
  const stripId = options?.stripId ?? `strip-${Date.now()}`;
  const rxSummary =
    prescribedMeds.length > 0
      ? prescribedMeds
          .map((m) => `${m.resolvedDrug.brandName} ${m.resolvedDrug.strengthText}`)
          .join(', ')
      : 'No active prescription';

  // Resolve the physical foil imprint against the local DGDA database
  let bestDrug = database[0];
  let bestScore = -1;

  const cleanedForGrounding = ocrStripRaw.trim();
  if (cleanedForGrounding.length > 0) {
    for (const drug of database) {
      const score = scoreDrugCandidate(cleanedForGrounding, drug, {
        dosageFormHint: options?.dosageFormHint,
        strengthHint: options?.strengthHint,
      });
      if (score.totalScore > bestScore) {
        bestScore = score.totalScore;
        bestDrug = drug;
      }
    }
  } else {
    bestScore = 0;
  }

  // 0. UNCERTAINTY ABSTENTION GATE — hold the red mismatch alert when foil is unreadable/damaged/cropped
  const rawIllegibility = detectRawTextIllegibility(ocrStripRaw);
  const lowOcrConfidence =
    typeof options?.ocrConfidence === 'number' &&
    options.ocrConfidence < BLISTER_MIN_OCR_CONFIDENCE;
  const explicitlyUnreadable = options?.readability === 'UNREADABLE';
  const damagedWithWeakMatch =
    Boolean(options?.isCroppedOrDamaged || options?.readability === 'PARTIAL') &&
    bestScore < BLISTER_DAMAGED_GROUNDING_THRESHOLD;
  const tooLowGroundingToTrust = bestScore < BLISTER_MIN_READABILITY_SCORE;

  if (
    explicitlyUnreadable ||
    lowOcrConfidence ||
    rawIllegibility !== null ||
    damagedWithWeakMatch ||
    tooLowGroundingToTrust
  ) {
    const abstentionReason =
      options?.readabilityReason ||
      rawIllegibility ||
      (options?.isCroppedOrDamaged
        ? 'foil imprint is cropped or damaged along the cut edge'
        : lowOcrConfidence
          ? 'imprint is too blurry or glare-obscured to read reliably'
          : 'foil text could not be read reliably enough to confirm a medicine name');

    return {
      stripId,
      status: 'UNREADABLE_FOIL',
      readabilityStatus: options?.readability === 'PARTIAL' ? 'PARTIAL' : 'UNREADABLE',
      abstentionReason,
      ocrStripRaw,
      dispensedDrug: null,
      dispensedScore: Number(Math.max(0, bestScore).toFixed(3)),
      prescribedItem: rxSummary,
      dispensedOnStrip: 'Unreadable / cut foil imprint',
      reasonEnglish: `Foil imprint unreadable (${abstentionReason}) — red mismatch alert withheld to avoid a false alarm. Please verify the full medicine box/batch or retake the photo in clear, flat lighting.`,
      alertBangla:
        'ওষুধের পাতার লেখা অস্পষ্ট, কাটা বা ঝাপসা হয়ে গেছে। ভুল সতর্কতা এড়াতে লাল অ্যালার্ট বন্ধ রাখা হয়েছে — অনুগ্রহ করে পরিষ্কার আলোতে আবার ছবি তুলুন অথবা পুরো বক্স দেখে ফার্মেসির সাথে মিলিয়ে নিন।',
      stripImageDataUrl: options?.stripImageDataUrl,
      claheImageDataUrl: options?.claheImageDataUrl,
    };
  }

  const dispensedLabel = formatDrugLabel(bestDrug);

  // 1. Check Exact Match (same brand, same active molecules, same strength)
  const exactMatch = prescribedMeds.find(
    (m) =>
      m.resolvedDrug.id === bestDrug.id ||
      (m.resolvedDrug.brandName.toLowerCase() === bestDrug.brandName.toLowerCase() &&
        m.resolvedDrug.strengthMg === bestDrug.strengthMg),
  );

  if (exactMatch) {
    return {
      stripId,
      status: 'EXACT_MATCH',
      readabilityStatus: 'CLEAR',
      ocrStripRaw,
      dispensedDrug: bestDrug,
      dispensedScore: bestScore,
      prescribedMatch: exactMatch,
      prescribedItem: formatDrugLabel(exactMatch.resolvedDrug),
      dispensedOnStrip: dispensedLabel,
      reasonEnglish: `Verified exact brand and strength match (${dispensedLabel}) against prescription.`,
      alertBangla: `নিশ্চিত হয়েছে: ফার্মেসি আপনাকে সঠিক ওষুধ ${bestDrug.banglaName} ${toBanglaDigits(bestDrug.strengthText)} দিয়েছে।`,
      priceDiffBdt: 0,
      stripImageDataUrl: options?.stripImageDataUrl,
      claheImageDataUrl: options?.claheImageDataUrl,
    };
  }

  // 2. Check Wrong Strength for SAME brand or SAME active generic (CRITICAL MISMATCH!)
  const sameGenericDifferentStrength = prescribedMeds.find((m) => {
    const sameMolecules =
      m.resolvedDrug.activeMoleculeIds.length === bestDrug.activeMoleculeIds.length &&
      m.resolvedDrug.activeMoleculeIds.every((id) => bestDrug.activeMoleculeIds.includes(id));
    return sameMolecules && m.resolvedDrug.strengthMg !== bestDrug.strengthMg;
  });

  if (sameGenericDifferentStrength) {
    const rx = sameGenericDifferentStrength.resolvedDrug;
    const rxStrengthBn = toBanglaDigits(rx.strengthText).replace(/mg/gi, ' মিলিগ্রাম');
    const stripStrengthBn = toBanglaDigits(bestDrug.strengthText).replace(/mg/gi, ' মিলিগ্রাম');

    return {
      stripId,
      status: 'CRITICAL_MISMATCH',
      readabilityStatus: 'CLEAR',
      ocrStripRaw,
      dispensedDrug: bestDrug,
      dispensedScore: bestScore,
      prescribedMatch: sameGenericDifferentStrength,
      prescribedItem: formatDrugLabel(rx),
      dispensedOnStrip: dispensedLabel,
      reasonEnglish: `Wrong strength dispensed! Prescription specifies ${formatDrugLabel(rx)}, but the physical blister strip contains ${dispensedLabel}.`,
      alertBangla: `সতর্কতা! প্রেসক্রিপশনে ${rxStrengthBn} লেখা আছে, কিন্তু ফার্মেসি আপনাকে ${stripStrengthBn} এর পাতা দিয়েছে।`,
      priceDiffBdt: Number((bestDrug.unitMrpBdt - rx.unitMrpBdt).toFixed(2)),
      stripImageDataUrl: options?.stripImageDataUrl,
      claheImageDataUrl: options?.claheImageDataUrl,
    };
  }

  // 3. Check Bio-Equivalent Generic Substitution (same exact molecules & strength, different local brand)
  const bioEquivalentMatch = prescribedMeds.find((m) => {
    const sameMolecules =
      m.resolvedDrug.activeMoleculeIds.length === bestDrug.activeMoleculeIds.length &&
      m.resolvedDrug.activeMoleculeIds.every((id) => bestDrug.activeMoleculeIds.includes(id));
    return sameMolecules && m.resolvedDrug.strengthMg === bestDrug.strengthMg;
  });

  if (bioEquivalentMatch) {
    const rx = bioEquivalentMatch.resolvedDrug;
    const priceDiff = Number((bestDrug.unitMrpBdt - rx.unitMrpBdt).toFixed(2));
    return {
      stripId,
      status: 'BIO_EQUIVALENT',
      readabilityStatus: 'CLEAR',
      ocrStripRaw,
      dispensedDrug: bestDrug,
      dispensedScore: bestScore,
      prescribedMatch: bioEquivalentMatch,
      prescribedItem: formatDrugLabel(rx),
      dispensedOnStrip: dispensedLabel,
      reasonEnglish: `Bio-equivalent local substitution: ${bestDrug.brandName} (${bestDrug.manufacturer}) contains the exact same active generic (${bestDrug.activeGenericDisplay} ${bestDrug.strengthText}) as prescribed ${rx.brandName}.`,
      alertBangla: `ভিন্ন ব্র্যান্ড কিন্তু একই ওষুধ: প্রেসক্রিপশনে ${rx.banglaName} লেখা ছিল, ফার্মেসি একই জেনেরিকের ${bestDrug.banglaName} ${toBanglaDigits(bestDrug.strengthText)} দিয়েছে। এটি নিরাপদ বিকল্প।`,
      priceDiffBdt: priceDiff,
      stripImageDataUrl: options?.stripImageDataUrl,
      claheImageDataUrl: options?.claheImageDataUrl,
    };
  }

  // 4. Completely Unprescribed / Wrong Drug (CRITICAL MISMATCH!)
  return {
    stripId,
    status: 'CRITICAL_MISMATCH',
    readabilityStatus: 'CLEAR',
    ocrStripRaw,
    dispensedDrug: bestDrug,
    dispensedScore: bestScore,
    prescribedItem: rxSummary,
    dispensedOnStrip: dispensedLabel,
    reasonEnglish: `Unprescribed drug mismatch! Physical strip ${dispensedLabel} (${bestDrug.activeGenericDisplay}) does not match any active molecule on the decoded prescription.`,
    alertBangla: `সতর্কতা! এই পাতাটি (${bestDrug.banglaName} ${toBanglaDigits(bestDrug.strengthText)}) আপনার প্রেসক্রিপশনে নেই। খাওয়ার আগে ফার্মেসিতে ফেরত দিন।`,
    stripImageDataUrl: options?.stripImageDataUrl,
    claheImageDataUrl: options?.claheImageDataUrl,
  };
}

/**
 * Stage 5: DGDA Official MRP & Generic Price Transparency Report.
 */
export function computePriceTransparency(
  medications: DecodedMedication[],
  database: DgdaDrugRecord[] = DGDA_DRUG_DATABASE,
): PriceTransparencyReport {
  let totalStatutoryMrpBdt = 0;
  let minBioEquivalentTotalBdt = 0;

  const rows: MedicationPriceRow[] = medications.map((med) => {
    const drug = med.resolvedDrug;
    const totalUnits = med.compiledSchedule.totalUnits;
    const lineTotalBdt = Number((drug.unitMrpBdt * totalUnits).toFixed(2));
    totalStatutoryMrpBdt += lineTotalBdt;

    // Find verified bio-equivalent Bangladeshi brands (exact same active molecules & strength)
    const alternatives: BioEquivalentOption[] = database
      .filter((candidate) => {
        if (candidate.id === drug.id) return false;
        const sameMolecules =
          candidate.activeMoleculeIds.length === drug.activeMoleculeIds.length &&
          candidate.activeMoleculeIds.every((m) => drug.activeMoleculeIds.includes(m));
        return sameMolecules && candidate.strengthMg === drug.strengthMg;
      })
      .map((candidate) => {
        const totalCostBdt = Number((candidate.unitMrpBdt * totalUnits).toFixed(2));
        const savingsBdt = Number((lineTotalBdt - totalCostBdt).toFixed(2));
        const savingsPercent =
          lineTotalBdt > 0 ? Math.round((savingsBdt / lineTotalBdt) * 100) : 0;
        return {
          drug: candidate,
          totalCostBdt,
          savingsBdt,
          savingsPercent,
        };
      })
      .sort((a, b) => a.totalCostBdt - b.totalCostBdt);

    const cheaperAlt = alternatives.find((a) => a.savingsBdt > 0);
    minBioEquivalentTotalBdt += cheaperAlt ? cheaperAlt.totalCostBdt : lineTotalBdt;

    return {
      medication: med,
      unitMrpBdt: drug.unitMrpBdt,
      totalUnits,
      lineTotalBdt,
      cheapestAlternative: cheaperAlt,
      alternatives,
    };
  });

  const potentialSavingsBdt = Number(
    Math.max(0, totalStatutoryMrpBdt - minBioEquivalentTotalBdt).toFixed(2),
  );
  const potentialSavingsPercent =
    totalStatutoryMrpBdt > 0
      ? Math.round((potentialSavingsBdt / totalStatutoryMrpBdt) * 100)
      : 0;

  return {
    totalStatutoryMrpBdt: Number(totalStatutoryMrpBdt.toFixed(2)),
    minBioEquivalentTotalBdt: Number(minBioEquivalentTotalBdt.toFixed(2)),
    potentialSavingsBdt,
    potentialSavingsPercent,
    rows,
  };
}

/**
 * Builds the exact structured pipeline JSON payload matching Page 6 of the OshudhGuard AI document,
 * extended with multi-visit provenance and blister uncertainty abstention status.
 */
export function buildPipelineJsonPayload(
  prescriptionId: string,
  patientContext: PatientContext,
  medications: DecodedMedication[],
  blisterChecks: BlisterVerificationResult[],
  clinicalAlerts: ClinicalAlert[],
  visits?: PrescriptionVisit[],
): PrescriptionPipelinePayload {
  const latestBlister = blisterChecks[0] ?? null;

  return {
    prescriptionId,
    createdAt: new Date().toISOString(),
    visits: visits && visits.length > 0 ? visits : undefined,
    patientContext: {
      age: patientContext.age ?? null,
      detectedConditions: patientContext.detectedConditions,
    },
    decodedMedications: medications.map((m) => ({
      ocrRaw: m.ocrRaw,
      resolvedBrand: formatDrugLabel(m.resolvedDrug),
      manufacturer: m.resolvedDrug.manufacturer,
      activeGeneric: m.resolvedDrug.activeGenericDisplay,
      groundingScore: m.groundingScore,
      unitMrpBdt: m.resolvedDrug.unitMrpBdt,
      scheduleShorthand: m.scheduleShorthand,
      banglaVoiceText: m.compiledSchedule.banglaVoiceText,
      visitLabel: m.visitLabel,
      visitDate: m.visitDate,
    })),
    blisterVerification: latestBlister
      ? {
          status: latestBlister.status.replace(/_/g, ' '),
          readabilityStatus: latestBlister.readabilityStatus,
          abstentionReason: latestBlister.abstentionReason,
          prescribedItem: latestBlister.prescribedItem,
          dispensedOnStrip: latestBlister.dispensedOnStrip,
          alertBangla: latestBlister.alertBangla,
        }
      : null,
    clinicalAlerts: clinicalAlerts.map((a) => ({
      alertType: a.alertType,
      severity: a.severity,
      isCrossVisit: a.isCrossVisit,
      visitsInvolved: a.visitsInvolved,
      drugInvolved: a.drugInvolved,
      clinicalReason: a.clinicalReason,
    })),
  };
}
