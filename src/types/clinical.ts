export type DosageForm =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Suspension'
  | 'Injection'
  | 'Inhaler'
  | 'Drops'
  | 'Gel';

export type MealTiming =
  | 'before_meal'
  | 'after_meal'
  | 'with_meal'
  | 'bedtime'
  | 'any';

export type ComorbidityId =
  | 'CKD'
  | 'PREGNANCY'
  | 'DIABETES'
  | 'HYPERTENSION'
  | 'PEDIATRIC'
  | 'HEPATIC'
  | 'ASTHMA'
  | 'GASTRIC_ULCER';

export interface DgdaDrugRecord {
  id: string;
  brandName: string;
  banglaName: string;
  dosageForm: DosageForm;
  strengthText: string;
  strengthMg: number;
  manufacturer: string;
  activeGenericDisplay: string;
  activeMoleculeIds: string[];
  therapeuticClass: string;
  unitMrpBdt: number;
  stripSize: number;
  standardMealTiming: MealTiming;
  commonShorthands: string[];
}

export interface RawVlmMedicationLine {
  lineId: string;
  ocrRaw: string;
  hypotheses: string[];
  dosageFormHint?: string;
  strengthHint?: string;
  scheduleShorthand: string;
  durationDays?: number;
  /** Normalized bounding box [yMin, xMin, yMax, xMax] in 0..1000 */
  bbox?: [number, number, number, number];
}

export interface ScoreBreakdown {
  denseCosine: number;
  levenshteinNorm: number;
  phoneticMatch: number;
  clinicalPrior: number;
  totalScore: number;
  matchedHypothesis: string;
}

export interface CandidateMatch {
  drug: DgdaDrugRecord;
  breakdown: ScoreBreakdown;
}

export interface CompiledSchedule {
  morning: number;
  noon: number;
  night: number;
  asNeeded: boolean;
  mealTiming: MealTiming;
  mealOffsetMinutes?: number;
  durationDays: number;
  dailyUnits: number;
  totalUnits: number;
  englishInstruction: string;
  banglaVoiceText: string;
  banglaTimingLabel: string;
  shorthandNormalized: string;
}

export interface PrescriptionVisit {
  visitId: string;
  prescriptionId: string;
  clinicName: string;
  doctorName?: string;
  visitDate: string;
}

export interface DecodedMedication {
  lineId: string;
  ocrRaw: string;
  hypotheses: string[];
  dosageFormHint?: string;
  strengthHint?: string;
  scheduleShorthand: string;
  bbox?: [number, number, number, number];
  croppedInkDataUrl?: string;
  visitId?: string;
  visitLabel?: string;
  visitDate?: string;
  resolvedDrug: DgdaDrugRecord;
  groundingScore: number;
  scoreBreakdown: ScoreBreakdown;
  topCandidates: CandidateMatch[];
  requiresHumanVerification: boolean;
  humanConfirmed: boolean;
  compiledSchedule: CompiledSchedule;
}

export interface PatientContext {
  patientName?: string;
  age?: number;
  sex?: string;
  doctorName?: string;
  clinicName?: string;
  detectedConditions: string[];
  activeComorbidities: ComorbidityId[];
}

export type AlertSeverity = 'HIGH' | 'MODERATE' | 'LOW';
export type ClinicalAlertType =
  | 'DUPLICATE_GENERIC'
  | 'DRUG_DRUG_INTERACTION'
  | 'COMORBIDITY_CONTRAINDICATION';

export interface ClinicalAlert {
  id: string;
  alertType: ClinicalAlertType;
  severity: AlertSeverity;
  drugInvolved: string;
  relatedDrugs: string[];
  activeMolecule?: string;
  isCrossVisit?: boolean;
  visitsInvolved?: string[];
  clinicalReason: string;
  banglaReason: string;
  recommendation: string;
}

export type BlisterStatus =
  | 'EXACT_MATCH'
  | 'BIO_EQUIVALENT'
  | 'CRITICAL_MISMATCH'
  | 'UNREADABLE_FOIL';

export type BlisterReadability = 'CLEAR' | 'PARTIAL' | 'UNREADABLE';

export interface BlisterVerificationResult {
  stripId: string;
  status: BlisterStatus;
  readabilityStatus?: BlisterReadability;
  abstentionReason?: string;
  ocrStripRaw: string;
  dispensedDrug: DgdaDrugRecord | null;
  dispensedScore: number;
  prescribedMatch?: DecodedMedication;
  prescribedItem: string;
  dispensedOnStrip: string;
  reasonEnglish: string;
  alertBangla: string;
  priceDiffBdt?: number;
  stripImageDataUrl?: string;
  claheImageDataUrl?: string;
}

export interface BioEquivalentOption {
  drug: DgdaDrugRecord;
  totalCostBdt: number;
  savingsBdt: number;
  savingsPercent: number;
}

export interface MedicationPriceRow {
  medication: DecodedMedication;
  unitMrpBdt: number;
  totalUnits: number;
  lineTotalBdt: number;
  cheapestAlternative?: BioEquivalentOption;
  alternatives: BioEquivalentOption[];
}

export interface PriceTransparencyReport {
  totalStatutoryMrpBdt: number;
  minBioEquivalentTotalBdt: number;
  potentialSavingsBdt: number;
  potentialSavingsPercent: number;
  rows: MedicationPriceRow[];
}

export interface PrescriptionPipelinePayload {
  prescriptionId: string;
  createdAt: string;
  visits?: PrescriptionVisit[];
  patientContext: {
    age: number | null;
    detectedConditions: string[];
  };
  decodedMedications: Array<{
    ocrRaw: string;
    resolvedBrand: string;
    manufacturer: string;
    activeGeneric: string;
    groundingScore: number;
    unitMrpBdt: number;
    scheduleShorthand: string;
    banglaVoiceText: string;
    visitLabel?: string;
    visitDate?: string;
  }>;
  blisterVerification: {
    status: string;
    readabilityStatus?: BlisterReadability;
    abstentionReason?: string;
    prescribedItem: string;
    dispensedOnStrip: string;
    alertBangla: string;
  } | null;
  clinicalAlerts: Array<{
    alertType: ClinicalAlertType;
    severity: AlertSeverity;
    isCrossVisit?: boolean;
    visitsInvolved?: string[];
    drugInvolved: string;
    clinicalReason: string;
  }>;
}

export interface SavedScanRecord {
  prescriptionId: string;
  savedAt: string;
  patientContext: PatientContext;
  visits?: PrescriptionVisit[];
  medications: DecodedMedication[];
  blisterChecks: BlisterVerificationResult[];
  prescriptionImageDataUrl?: string;
}
