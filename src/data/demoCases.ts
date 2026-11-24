import type { BlisterReadability, ComorbidityId, RawVlmMedicationLine } from '../types/clinical';

export interface DemoPrescriptionCase {
  id: string;
  prescriptionId: string;
  titleEn: string;
  titleBn: string;
  subtitle: string;
  doctorName: string;
  clinicName: string;
  visitDate: string;
  patientName: string;
  age: number;
  sex: string;
  diagnosisNotes: string[];
  defaultComorbidities: ComorbidityId[];
  rawLines: RawVlmMedicationLine[];
}

export interface DemoBlisterFixture {
  id: string;
  labelEn: string;
  labelBn: string;
  expectedOutcomeHint: string;
  foilBrandPrint: string;
  foilGenericPrint: string;
  foilStrengthPrint: string;
  foilManufacturer: string;
  foilColorHex: string;
  ocrStripRaw: string;
  dosageFormHint: string;
  strengthHint: string;
  damagedMode?: 'scissor_cut_glare';
  readability?: BlisterReadability;
  isCroppedOrDamaged?: boolean;
  ocrConfidence?: number;
  readabilityReason?: string;
}

export const DEMO_PRESCRIPTION_CASES: DemoPrescriptionCase[] = [
  {
    id: 'case-ckd-polypharmacy',
    prescriptionId: 'COU-RX-2026-089',
    titleEn: 'CKD Polypharmacy & Silent Duplicate',
    titleBn: 'কিডনি রোগী ও ডুপ্লিকেট জেনেরিক কেস',
    subtitle: '62y Male · CKD Stage 3, HTN · Contains NSAID contraindication, duplicate Esomeprazole & 1 low-confidence scribble',
    doctorName: 'Prof. Dr. M. A. Rahman, FCPS (Medicine)',
    clinicName: 'Cumilla Medical Center, Kandirpar',
    visitDate: '20 Nov 2026',
    patientName: 'Md. Abdul Karim',
    age: 62,
    sex: 'Male',
    diagnosisNotes: ['CKD Stage 3 (eGFR 42)', 'Hypertension (HTN)', 'Chronic Knee Osteoarthritis'],
    defaultComorbidities: ['CKD', 'HYPERTENSION'],
    rawLines: [
      {
        lineId: 'rx-1',
        ocrRaw: 'Cap. Srgel 20',
        hypotheses: ['Cap. Srgel 20', 'Cap. Sergel 20', 'Cap. Seclo 20'],
        dosageFormHint: 'Capsule',
        strengthHint: '20mg',
        scheduleShorthand: '1+0+1 a/c 30m for 14 days',
        durationDays: 14,
        bbox: [390, 265, 448, 940],
      },
      {
        lineId: 'rx-2',
        ocrRaw: 'Tab. Naprosyn 500',
        hypotheses: ['Tab. Naprosyn 500', 'Tab. Napro-A 500', 'Tab. Napa 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+0+1 p/c for 7 days',
        durationDays: 7,
        bbox: [488, 265, 546, 940],
      },
      {
        lineId: 'rx-3',
        ocrRaw: 'Tab. Maxpro 20',
        hypotheses: ['Tab. Maxpro 20', 'Tab. Maxpr 20', 'Tab. Moxacil 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '20mg',
        scheduleShorthand: '1+0+0 a/c 30m for 14 days',
        durationDays: 14,
        bbox: [586, 265, 644, 940],
      },
      {
        lineId: 'rx-4',
        ocrRaw: 'Tab. Losardil 50',
        hypotheses: ['Tab. Losardil 50', 'Tab. Losartil 50', 'Tab. Osartil 50'],
        dosageFormHint: 'Tablet',
        strengthHint: '50mg',
        scheduleShorthand: '1+0+0 p/c for 30 days',
        durationDays: 30,
        bbox: [684, 265, 742, 940],
      },
      {
        lineId: 'rx-5',
        ocrRaw: 'Tab. Mns 10',
        hypotheses: ['Tab. Mns 10', 'Tab. Mnt 10', 'Tab. Mks 10'],
        dosageFormHint: 'Tablet',
        strengthHint: '10mg',
        scheduleShorthand: '0+0+1 HS for 14 days',
        durationDays: 14,
        bbox: [782, 265, 845, 940],
      },
    ],
  },
  {
    id: 'case-cardiac-ddi',
    prescriptionId: 'COU-RX-2026-104',
    titleEn: 'Post-Stent Cardiac DDI Audit',
    titleBn: 'হৃদরোগী ও ড্রাগ-ইন্টারেকশন কেস',
    subtitle: '58y Male · IHD, Post-PCI, DM · Flags Clopidogrel + Omeprazole CYP2C19 interaction & MRP savings',
    doctorName: 'Dr. Farhana Yasmin, MD (Cardiology)',
    clinicName: 'Chattogram Heart Care Chamber',
    visitDate: '21 Nov 2026',
    patientName: 'Haji Nurul Islam',
    age: 58,
    sex: 'Male',
    diagnosisNotes: ['Post-PCI (LAD Stent)', 'Type 2 Diabetes (T2DM)', 'Dyslipidemia'],
    defaultComorbidities: ['DIABETES', 'HYPERTENSION'],
    rawLines: [
      {
        lineId: 'rx-c1',
        ocrRaw: 'Tab. Anclog 75',
        hypotheses: ['Tab. Anclog 75', 'Tab. Clopid 75'],
        dosageFormHint: 'Tablet',
        strengthHint: '75mg',
        scheduleShorthand: '0+1+0 p/c for 30 days',
        durationDays: 30,
        bbox: [390, 265, 448, 940],
      },
      {
        lineId: 'rx-c2',
        ocrRaw: 'Cap. Seclo 20',
        hypotheses: ['Cap. Seclo 20', 'Cap. Seklo 20', 'Cap. Sergel 20'],
        dosageFormHint: 'Capsule',
        strengthHint: '20mg',
        scheduleShorthand: '1+0+1 a/c 30m for 30 days',
        durationDays: 30,
        bbox: [488, 265, 546, 940],
      },
      {
        lineId: 'rx-c3',
        ocrRaw: 'Tab. Atova 20',
        hypotheses: ['Tab. Atova 20', 'Tab. Atorva 20'],
        dosageFormHint: 'Tablet',
        strengthHint: '20mg',
        scheduleShorthand: '0+0+1 HS for 30 days',
        durationDays: 30,
        bbox: [586, 265, 644, 940],
      },
      {
        lineId: 'rx-c4',
        ocrRaw: 'Tab. Comet 500',
        hypotheses: ['Tab. Comet 500', 'Tab. Commet 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+0+1 p/c for 30 days',
        durationDays: 30,
        bbox: [684, 265, 742, 940],
      },
    ],
  },
  {
    id: 'case-antenatal-duplicate',
    prescriptionId: 'COU-RX-2026-117',
    titleEn: 'Antenatal Safety & Fever Double-Dose',
    titleBn: 'গর্ভাবস্থায় নিরাপদ ওষুধ ও জ্বরের কেস',
    subtitle: '27y Female · 24 Weeks Pregnancy · Flags Ciprofloxacin pregnancy contraindication & Paracetamol duplicate',
    doctorName: 'Dr. Nusrat Jahan, FCPS (Obs & Gynae)',
    clinicName: 'Upazila Health Complex, Burichang',
    visitDate: '22 Nov 2026',
    patientName: 'Salma Akter',
    age: 27,
    sex: 'Female',
    diagnosisNotes: ['Pregnancy 24 Weeks (G2P1)', 'Acute UTI & Fever'],
    defaultComorbidities: ['PREGNANCY'],
    rawLines: [
      {
        lineId: 'rx-p1',
        ocrRaw: 'Tab. Ciprocin 500',
        hypotheses: ['Tab. Ciprocin 500', 'Tab. Ciproxin 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+0+1 p/c for 7 days',
        durationDays: 7,
        bbox: [390, 265, 448, 940],
      },
      {
        lineId: 'rx-p2',
        ocrRaw: 'Tab. Napa Extra 500',
        hypotheses: ['Tab. Napa Extra 500', 'Tab. Napa 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+1+1 p/c for 5 days',
        durationDays: 5,
        bbox: [488, 265, 546, 940],
      },
      {
        lineId: 'rx-p3',
        ocrRaw: 'Tab. Ace Plus 500',
        hypotheses: ['Tab. Ace Plus 500', 'Tab. Ace 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+0+1 p/c for 5 days',
        durationDays: 5,
        bbox: [586, 265, 644, 940],
      },
      {
        lineId: 'rx-p4',
        ocrRaw: 'Tab. Coralcal-D 500',
        hypotheses: ['Tab. Coralcal-D 500', 'Tab. Calbo-D 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '0+1+0 p/c for 30 days',
        durationDays: 30,
        bbox: [684, 265, 742, 940],
      },
    ],
  },
];

export const DEMO_FOLLOWUP_CLINIC_VISITS: DemoPrescriptionCase[] = [
  {
    id: 'clinic-b-ortho',
    prescriptionId: 'COU-RX-2026-201',
    titleEn: 'Ortho Clinic B (24 Nov)',
    titleBn: 'অর্থো ক্লিনিক বি (২৪ নভে)',
    subtitle: 'Second clinic visit · Adds Maxpro 20mg, Ace Plus 500mg & Naprosyn 500mg',
    doctorName: 'Dr. Kamrul Hasan, MS (Orthopedics)',
    clinicName: 'Popular Orthopedic Chamber, Cumilla',
    visitDate: '24 Nov 2026',
    patientName: 'Md. Abdul Karim',
    age: 62,
    sex: 'Male',
    diagnosisNotes: ['Right Knee Joint Pain'],
    defaultComorbidities: [],
    rawLines: [
      {
        lineId: 'rx-b1',
        ocrRaw: 'Tab. Maxpro 20',
        hypotheses: ['Tab. Maxpro 20', 'Tab. Maxpr 20'],
        dosageFormHint: 'Tablet',
        strengthHint: '20mg',
        scheduleShorthand: '1+0+1 a/c 30m for 14 days',
        durationDays: 14,
      },
      {
        lineId: 'rx-b2',
        ocrRaw: 'Tab. Ace Plus 500',
        hypotheses: ['Tab. Ace Plus 500', 'Tab. Ace 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+1+1 p/c for 5 days',
        durationDays: 5,
      },
      {
        lineId: 'rx-b3',
        ocrRaw: 'Tab. Napro-A 500',
        hypotheses: ['Tab. Napro-A 500', 'Tab. Naprosyn 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '500mg',
        scheduleShorthand: '1+0+1 p/c for 7 days',
        durationDays: 7,
      },
    ],
  },
  {
    id: 'clinic-b-cardio',
    prescriptionId: 'COU-RX-2026-208',
    titleEn: 'Heart Clinic B (24 Nov)',
    titleBn: 'হৃদরোগ ক্লিনিক বি (২৪ নভে)',
    subtitle: 'Second clinic visit · Adds Anclog 75mg, Seclo 20mg & Napa Extend 665mg',
    doctorName: 'Dr. S. M. Tariq, MD (Cardiology)',
    clinicName: 'Dhaka Specialized Heart Clinic',
    visitDate: '24 Nov 2026',
    patientName: 'Haji Nurul Islam',
    age: 58,
    sex: 'Male',
    diagnosisNotes: ['Chest discomfort follow-up'],
    defaultComorbidities: ['HYPERTENSION'],
    rawLines: [
      {
        lineId: 'rx-bc1',
        ocrRaw: 'Tab. Anclog 75',
        hypotheses: ['Tab. Anclog 75', 'Tab. Clopid 75'],
        dosageFormHint: 'Tablet',
        strengthHint: '75mg',
        scheduleShorthand: '0+1+0 p/c for 30 days',
        durationDays: 30,
      },
      {
        lineId: 'rx-bc2',
        ocrRaw: 'Cap. Seclo 20',
        hypotheses: ['Cap. Seclo 20', 'Cap. Sergel 20'],
        dosageFormHint: 'Capsule',
        strengthHint: '20mg',
        scheduleShorthand: '1+0+1 a/c 30m for 14 days',
        durationDays: 14,
      },
      {
        lineId: 'rx-bc3',
        ocrRaw: 'Tab. Napa Extend 665',
        hypotheses: ['Tab. Napa Extend 665', 'Tab. Napa 500'],
        dosageFormHint: 'Tablet',
        strengthHint: '665mg',
        scheduleShorthand: '1+1+1 p/c for 5 days',
        durationDays: 5,
      },
    ],
  },
];

export const DEMO_BLISTER_FIXTURES: DemoBlisterFixture[] = [
  {
    id: 'strip-sergel-40-mismatch',
    labelEn: 'Wrong Strength: Sergel 40mg Foil',
    labelBn: 'ভুল মাত্রা: সার্জেল ৪০ মি.গ্রা. পাতা',
    expectedOutcomeHint: 'Triggers Red Critical Mismatch Alert against Sergel 20mg Rx',
    foilBrandPrint: 'SERGEL 40',
    foilGenericPrint: 'Esomeprazole 40mg Capsule',
    foilStrengthPrint: '40mg',
    foilManufacturer: 'Healthcare Pharmaceuticals',
    foilColorHex: '#991b1b',
    ocrStripRaw: 'Cap. Sergel 40mg',
    dosageFormHint: 'Capsule',
    strengthHint: '40mg',
    readability: 'CLEAR',
    ocrConfidence: 0.96,
  },
  {
    id: 'strip-damaged-cut-unreadable',
    labelEn: 'Scissor-Cut / Glare Foil (Unreadable)',
    labelBn: 'কাটা ও ঝাপসা পাতা (পড়া যাচ্ছে না)',
    expectedOutcomeHint: 'Holds back Red Mismatch Alert — enters Neutral Manual Check abstention',
    foilBrandPrint: '..RG.. ?0',
    foilGenericPrint: 'Esomep... [cut]',
    foilStrengthPrint: '?0mg',
    foilManufacturer: '...care Pharm...',
    foilColorHex: '#64748b',
    ocrStripRaw: '..rg.. ?0m..',
    dosageFormHint: '',
    strengthHint: '',
    damagedMode: 'scissor_cut_glare',
    readability: 'UNREADABLE',
    isCroppedOrDamaged: true,
    ocrConfidence: 0.24,
    readabilityReason: 'cut across the brand name with heavy metallic glare',
  },
  {
    id: 'strip-sergel-20-exact',
    labelEn: 'Exact Match: Sergel 20mg Foil',
    labelBn: 'সঠিক ওষুধ: সার্জেল ২০ মি.গ্রা. পাতা',
    expectedOutcomeHint: 'Triggers Green Exact Match verification',
    foilBrandPrint: 'SERGEL 20',
    foilGenericPrint: 'Esomeprazole 20mg Capsule',
    foilStrengthPrint: '20mg',
    foilManufacturer: 'Healthcare Pharmaceuticals',
    foilColorHex: '#0f766e',
    ocrStripRaw: 'Cap. Sergel 20mg',
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
    readability: 'CLEAR',
    ocrConfidence: 0.97,
  },
  {
    id: 'strip-exium-20-bioeq',
    labelEn: 'Bio-Equivalent: Exium 20mg Foil',
    labelBn: 'একই জেনেরিক: এক্সিয়াম ২০ মি.গ্রা. পাতা',
    expectedOutcomeHint: 'Triggers Amber Bio-Equivalent Substitution (৳5 vs ৳7)',
    foilBrandPrint: 'EXIUM 20',
    foilGenericPrint: 'Esomeprazole 20mg Capsule',
    foilStrengthPrint: '20mg',
    foilManufacturer: 'Radiant Pharmaceuticals',
    foilColorHex: '#1d4ed8',
    ocrStripRaw: 'Cap. Exium 20mg',
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
    readability: 'CLEAR',
    ocrConfidence: 0.95,
  },
  {
    id: 'strip-amdocal-5-wrong',
    labelEn: 'Wrong Drug: Amdocal 5mg Foil',
    labelBn: 'ভিন্ন ওষুধ: অ্যামডোক্যাল ৫ মি.গ্রা. পাতা',
    expectedOutcomeHint: 'Triggers Red Critical Mismatch (Unprescribed drug)',
    foilBrandPrint: 'AMDOCAL 5',
    foilGenericPrint: 'Amlodipine 5mg Tablet',
    foilStrengthPrint: '5mg',
    foilManufacturer: 'Beximco Pharma',
    foilColorHex: '#4338ca',
    ocrStripRaw: 'Tab. Amdocal 5mg',
    dosageFormHint: 'Tablet',
    strengthHint: '5mg',
    readability: 'CLEAR',
    ocrConfidence: 0.96,
  },
];
