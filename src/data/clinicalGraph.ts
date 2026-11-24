import type { AlertSeverity, ComorbidityId } from '../types/clinical';

export interface MoleculeNode {
  id: string;
  canonicalName: string;
  banglaName: string;
  drugClass: string;
  isNsaid?: boolean;
  isPpi?: boolean;
  isArbOrAcei?: boolean;
  isAntiplatelet?: boolean;
  isSulfonylurea?: boolean;
  isFluoroquinolone?: boolean;
}

export interface DdiEdge {
  id: string;
  moleculeA: string;
  moleculeB: string;
  severity: AlertSeverity;
  clinicalReason: string;
  banglaReason: string;
  recommendation: string;
}

export interface ComorbidityRule {
  id: string;
  comorbidity: ComorbidityId;
  molecules: string[];
  severity: AlertSeverity;
  clinicalReason: string;
  banglaReason: string;
  recommendation: string;
}

export const COMORBIDITY_METADATA: Record<
  ComorbidityId,
  { labelEn: string; labelBn: string; keywords: string[] }
> = {
  CKD: {
    labelEn: 'CKD / Renal Disease',
    labelBn: 'কিডনি রোগ (CKD)',
    keywords: ['ckd', 'renal', 'kidney', 'creatinine', 'nephro', 'কিডনি'],
  },
  PREGNANCY: {
    labelEn: 'Pregnancy',
    labelBn: 'গর্ভাবস্থা',
    keywords: ['preg', 'gravida', 'antenatal', 'trimester', 'গর্ভ'],
  },
  DIABETES: {
    labelEn: 'Diabetes (DM)',
    labelBn: 'ডায়াবেটিস (DM)',
    keywords: ['dm', 'diabetes', 't2dm', 'diabetic', 'ডায়াবেটিস', 'সুগার'],
  },
  HYPERTENSION: {
    labelEn: 'Hypertension (HTN)',
    labelBn: 'উচ্চ রক্তচাপ (HTN)',
    keywords: ['htn', 'hypertension', 'high bp', 'রক্তচাপ', 'প্রেসার'],
  },
  PEDIATRIC: {
    labelEn: 'Pediatric (<12y)',
    labelBn: 'শিশু (১২ বছরের কম)',
    keywords: ['pediatric', 'child', 'infant', 'শিশু'],
  },
  HEPATIC: {
    labelEn: 'Liver / Hepatic Disease',
    labelBn: 'লিভার রোগ',
    keywords: ['hepatic', 'liver', 'cirrhosis', 'cld', 'fatty liver', 'লিভার'],
  },
  ASTHMA: {
    labelEn: 'Asthma / COPD',
    labelBn: 'অ্যাজমা / শ্বাসকষ্ট',
    keywords: ['asthma', 'copd', 'bronchospasm', 'অ্যাজমা', 'শ্বাসকষ্ট'],
  },
  GASTRIC_ULCER: {
    labelEn: 'Peptic Ulcer / GI Bleed',
    labelBn: 'গ্যাস্ট্রিক আলসার',
    keywords: ['ulcer', 'pud', 'gi bleed', 'gastritis', 'আলসার'],
  },
};

export const MOLECULE_NODES: Record<string, MoleculeNode> = {
  esomeprazole: {
    id: 'esomeprazole',
    canonicalName: 'Esomeprazole',
    banglaName: 'ইসোমিপ্রাজল',
    drugClass: 'PPI',
    isPpi: true,
  },
  omeprazole: {
    id: 'omeprazole',
    canonicalName: 'Omeprazole',
    banglaName: 'ওমিপ্রাজল',
    drugClass: 'PPI',
    isPpi: true,
  },
  pantoprazole: {
    id: 'pantoprazole',
    canonicalName: 'Pantoprazole',
    banglaName: 'প্যানটোপ্রাজল',
    drugClass: 'PPI',
    isPpi: true,
  },
  rabeprazole: {
    id: 'rabeprazole',
    canonicalName: 'Rabeprazole',
    banglaName: 'র‍্যাবিপ্রাজল',
    drugClass: 'PPI',
    isPpi: true,
  },
  paracetamol: {
    id: 'paracetamol',
    canonicalName: 'Paracetamol',
    banglaName: 'প্যারাসিটামল',
    drugClass: 'Analgesic',
  },
  caffeine: {
    id: 'caffeine',
    canonicalName: 'Caffeine',
    banglaName: 'ক্যাফেইন',
    drugClass: 'Stimulant Adjuvant',
  },
  naproxen: {
    id: 'naproxen',
    canonicalName: 'Naproxen',
    banglaName: 'ন্যাপ্রোক্সেন',
    drugClass: 'NSAID',
    isNsaid: true,
  },
  diclofenac: {
    id: 'diclofenac',
    canonicalName: 'Diclofenac',
    banglaName: 'ডাইক্লোফেনাক',
    drugClass: 'NSAID',
    isNsaid: true,
  },
  ketorolac: {
    id: 'ketorolac',
    canonicalName: 'Ketorolac',
    banglaName: 'কিটোরোলাক',
    drugClass: 'NSAID',
    isNsaid: true,
  },
  aceclofenac: {
    id: 'aceclofenac',
    canonicalName: 'Aceclofenac',
    banglaName: 'অ্যাসিক্লোফেনাক',
    drugClass: 'NSAID',
    isNsaid: true,
  },
  ibuprofen: {
    id: 'ibuprofen',
    canonicalName: 'Ibuprofen',
    banglaName: 'আইবুপ্রোফেন',
    drugClass: 'NSAID',
    isNsaid: true,
  },
  losartan: {
    id: 'losartan',
    canonicalName: 'Losartan',
    banglaName: 'লোসারটান',
    drugClass: 'ARB',
    isArbOrAcei: true,
  },
  olmesartan: {
    id: 'olmesartan',
    canonicalName: 'Olmesartan',
    banglaName: 'অলমেসারটান',
    drugClass: 'ARB',
    isArbOrAcei: true,
  },
  amlodipine: {
    id: 'amlodipine',
    canonicalName: 'Amlodipine',
    banglaName: 'অ্যামলোডিপিন',
    drugClass: 'CCB',
  },
  bisoprolol: {
    id: 'bisoprolol',
    canonicalName: 'Bisoprolol',
    banglaName: 'বিসোপ্রোলল',
    drugClass: 'Beta Blocker',
  },
  propranolol: {
    id: 'propranolol',
    canonicalName: 'Propranolol',
    banglaName: 'প্রোপ্রানোলল',
    drugClass: 'Non-Selective Beta Blocker',
  },
  aspirin: {
    id: 'aspirin',
    canonicalName: 'Aspirin',
    banglaName: 'অ্যাসপিরিন',
    drugClass: 'Antiplatelet',
    isAntiplatelet: true,
  },
  clopidogrel: {
    id: 'clopidogrel',
    canonicalName: 'Clopidogrel',
    banglaName: 'ক্লোপিডোগ্রেল',
    drugClass: 'Antiplatelet',
    isAntiplatelet: true,
  },
  warfarin: {
    id: 'warfarin',
    canonicalName: 'Warfarin',
    banglaName: 'ওয়ারফারিন',
    drugClass: 'Anticoagulant',
  },
  atorvastatin: {
    id: 'atorvastatin',
    canonicalName: 'Atorvastatin',
    banglaName: 'অ্যাটোরভাস্ট্যাটিন',
    drugClass: 'Statin',
  },
  rosuvastatin: {
    id: 'rosuvastatin',
    canonicalName: 'Rosuvastatin',
    banglaName: 'রোসুভাস্ট্যাটিন',
    drugClass: 'Statin',
  },
  metformin: {
    id: 'metformin',
    canonicalName: 'Metformin',
    banglaName: 'মেটফরমিন',
    drugClass: 'Biguanide',
  },
  linagliptin: {
    id: 'linagliptin',
    canonicalName: 'Linagliptin',
    banglaName: 'লিনাগ্লিপটিন',
    drugClass: 'DPP-4 Inhibitor',
  },
  glimepiride: {
    id: 'glimepiride',
    canonicalName: 'Glimepiride',
    banglaName: 'গ্লিমেপিরাইড',
    drugClass: 'Sulfonylurea',
    isSulfonylurea: true,
  },
  gliclazide: {
    id: 'gliclazide',
    canonicalName: 'Gliclazide',
    banglaName: 'গ্লিক্লাজাইড',
    drugClass: 'Sulfonylurea',
    isSulfonylurea: true,
  },
  azithromycin: {
    id: 'azithromycin',
    canonicalName: 'Azithromycin',
    banglaName: 'অ্যাজিথ্রোমাইসিন',
    drugClass: 'Macrolide',
  },
  cefixime: {
    id: 'cefixime',
    canonicalName: 'Cefixime',
    banglaName: 'সেফিক্সিম',
    drugClass: 'Cephalosporin',
  },
  ciprofloxacin: {
    id: 'ciprofloxacin',
    canonicalName: 'Ciprofloxacin',
    banglaName: 'সিপ্রোফ্লক্সাসিন',
    drugClass: 'Fluoroquinolone',
    isFluoroquinolone: true,
  },
  amoxicillin: {
    id: 'amoxicillin',
    canonicalName: 'Amoxicillin',
    banglaName: 'অ্যামোক্সিসিলিন',
    drugClass: 'Penicillin',
  },
  metronidazole: {
    id: 'metronidazole',
    canonicalName: 'Metronidazole',
    banglaName: 'মেট্রোনিডাজল',
    drugClass: 'Nitroimidazole',
  },
  montelukast: {
    id: 'montelukast',
    canonicalName: 'Montelukast',
    banglaName: 'মন্টেলুকাস্ট',
    drugClass: 'Leukotriene Antagonist',
  },
  fexofenadine: {
    id: 'fexofenadine',
    canonicalName: 'Fexofenadine',
    banglaName: 'ফেক্সোফেনাডিন',
    drugClass: 'Antihistamine',
  },
  cetirizine: {
    id: 'cetirizine',
    canonicalName: 'Cetirizine',
    banglaName: 'সেটিরিজিন',
    drugClass: 'Antihistamine',
  },
  doxofylline: {
    id: 'doxofylline',
    canonicalName: 'Doxofylline',
    banglaName: 'ডক্সোফাইলিন',
    drugClass: 'Bronchodilator',
  },
  furosemide: {
    id: 'furosemide',
    canonicalName: 'Furosemide',
    banglaName: 'ফিউরোসেমাইড',
    drugClass: 'Loop Diuretic',
  },
  domperidone: {
    id: 'domperidone',
    canonicalName: 'Domperidone',
    banglaName: 'ডমপেরিডন',
    drugClass: 'Prokinetic',
  },
  levothyroxine: {
    id: 'levothyroxine',
    canonicalName: 'Levothyroxine',
    banglaName: 'লেভোথাইরক্সিন',
    drugClass: 'Thyroid Hormone',
  },
  calcium: {
    id: 'calcium',
    canonicalName: 'Calcium Carbonate',
    banglaName: 'ক্যালসিয়াম',
    drugClass: 'Mineral',
  },
  vitamin_d3: {
    id: 'vitamin_d3',
    canonicalName: 'Vitamin D3',
    banglaName: 'ভিটামিন ডি৩',
    drugClass: 'Vitamin',
  },
  vitamin_b_complex: {
    id: 'vitamin_b_complex',
    canonicalName: 'Vitamin B1+B6+B12',
    banglaName: 'ভিটামিন বি-কমপ্লেক্স',
    drugClass: 'Vitamin',
  },
};

export const DDI_GRAPH_EDGES: DdiEdge[] = [
  {
    id: 'ddi-clopidogrel-omeprazole',
    moleculeA: 'clopidogrel',
    moleculeB: 'omeprazole',
    severity: 'HIGH',
    clinicalReason:
      'Omeprazole strongly inhibits CYP2C19 activation of Clopidogrel, significantly reducing antiplatelet protection and increasing stent/stroke risk.',
    banglaReason:
      'ওমিপ্রাজল ক্লোপিডোগ্রেলের কার্যকারিতা কমিয়ে দেয়, যা হার্ট অ্যাটাক বা স্ট্রোকের ঝুঁকি বাড়াতে পারে।',
    recommendation:
      'Ask physician about switching PPI from Omeprazole to Pantoprazole (e.g., Pantonix).',
  },
  {
    id: 'ddi-clopidogrel-esomeprazole',
    moleculeA: 'clopidogrel',
    moleculeB: 'esomeprazole',
    severity: 'HIGH',
    clinicalReason:
      'Esomeprazole inhibits CYP2C19 conversion of Clopidogrel into its active antiplatelet metabolite.',
    banglaReason:
      'ইসোমিপ্রাজল ক্লোপিডোগ্রেলের রক্ত পাতলা করার ক্ষমতা কমিয়ে দিতে পারে।',
    recommendation:
      'Confirm with cardiologist; Pantoprazole has minimal CYP2C19 interaction.',
  },
  {
    id: 'ddi-nsaid-losartan',
    moleculeA: 'naproxen',
    moleculeB: 'losartan',
    severity: 'HIGH',
    clinicalReason:
      'Co-prescribing NSAIDs (Naproxen) with ARBs (Losartan) impairs renal afferent/efferent autoregulation, risking acute kidney injury and reduced blood pressure control.',
    banglaReason:
      'ন্যাপ্রোক্সেন ও লোসারটান একসাথে খেলে কিডনির ক্ষতি হতে পারে এবং রক্তচাপ নিয়ন্ত্রণ ব্যাহত হতে পারে।',
    recommendation:
      'Avoid NSAID if possible; monitor serum creatinine and blood pressure closely.',
  },
  {
    id: 'ddi-diclofenac-losartan',
    moleculeA: 'diclofenac',
    moleculeB: 'losartan',
    severity: 'HIGH',
    clinicalReason:
      'Diclofenac combined with Losartan elevates acute renal injury risk and blunts antihypertensive efficacy.',
    banglaReason:
      'ডাইক্লোফেনাক ও লোসারটান একসাথে কিডনির ওপর মারাত্মক চাপ সৃষ্টি করে।',
    recommendation: 'Consult doctor for renal-safe analgesic alternative.',
  },
  {
    id: 'ddi-ketorolac-losartan',
    moleculeA: 'ketorolac',
    moleculeB: 'losartan',
    severity: 'HIGH',
    clinicalReason:
      'Ketorolac is a potent nephrotoxic NSAID; combined with Losartan it sharply increases acute kidney injury risk.',
    banglaReason:
      'কিটোরোলাক ও লোসারটান একসাথে খেলে কিডনি বিকল হওয়ার ঝুঁকি অনেক বেড়ে যায়।',
    recommendation: 'Discontinue Ketorolac immediately and consult physician.',
  },
  {
    id: 'ddi-nsaid-aspirin',
    moleculeA: 'naproxen',
    moleculeB: 'aspirin',
    severity: 'HIGH',
    clinicalReason:
      'Naproxen competes with low-dose Aspirin at COX-1 binding sites and markedly increases upper GI bleeding risk.',
    banglaReason:
      'ন্যাপ্রোক্সেন ও অ্যাসপিরিন একসাথে খেলে পাকস্থলীতে রক্তক্ষরণের ঝুঁকি বেড়ে যায়।',
    recommendation: 'Avoid concurrent NSAID with antiplatelet therapy unless supervised.',
  },
  {
    id: 'ddi-ketorolac-aspirin',
    moleculeA: 'ketorolac',
    moleculeB: 'aspirin',
    severity: 'HIGH',
    clinicalReason:
      'Ketorolac plus Aspirin is strictly contraindicated due to severe gastrointestinal hemorrhage and ulcer perforation risk.',
    banglaReason:
      'কিটোরোলাক ও অ্যাসপিরিন একসাথে খাওয়া নিষিদ্ধ — এতে পাকস্থলীতে মারাত্মক রক্তক্ষরণ হতে পারে।',
    recommendation: 'Do not dispense together; contact prescriber immediately.',
  },
  {
    id: 'ddi-warfarin-naproxen',
    moleculeA: 'warfarin',
    moleculeB: 'naproxen',
    severity: 'HIGH',
    clinicalReason:
      'NSAIDs displace Warfarin and damage gastric mucosa, causing life-threatening internal bleeding.',
    banglaReason:
      'ওয়ারফারিন ও ন্যাপ্রোক্সেন একসাথে খেলে মারাত্মক অভ্যন্তরীণ রক্তক্ষরণ হতে পারে।',
    recommendation: 'Contraindicated pair. Urgent physician review required.',
  },
  {
    id: 'ddi-warfarin-azithromycin',
    moleculeA: 'warfarin',
    moleculeB: 'azithromycin',
    severity: 'MODERATE',
    clinicalReason:
      'Azithromycin can potentiate Warfarin anticoagulation and elevate INR unpredictably.',
    banglaReason:
      'অ্যাজিথ্রোমাইসিন ওয়ারফারিনের প্রভাব বাড়িয়ে রক্তক্ষরণের ঝুঁকি তৈরি করতে পারে।',
    recommendation: 'Check INR within 3–5 days of starting antibiotic.',
  },
  {
    id: 'ddi-warfarin-metronidazole',
    moleculeA: 'warfarin',
    moleculeB: 'metronidazole',
    severity: 'HIGH',
    clinicalReason:
      'Metronidazole inhibits Warfarin metabolism (CYP2C9), causing dangerous INR spikes and bleeding.',
    banglaReason:
      'মেট্রোনিডাজল ওয়ারফারিনের মাত্রা বিপজ্জনকভাবে বাড়িয়ে দেয়।',
    recommendation: 'Requires immediate dose adjustment and INR monitoring.',
  },
  {
    id: 'ddi-ciprofloxacin-calcium',
    moleculeA: 'ciprofloxacin',
    moleculeB: 'calcium',
    severity: 'MODERATE',
    clinicalReason:
      'Calcium ions chelate Ciprofloxacin in the gut, cutting antibiotic absorption by up to 50% and risking treatment failure.',
    banglaReason:
      'ক্যালসিয়াম ট্যাবলেট সিপ্রোফ্লক্সাসিনের শোষণ কমিয়ে দেয়, ফলে অ্যান্টিবায়োটিক ঠিকমতো কাজ করে না।',
    recommendation:
      'Separate Ciprofloxacin and Calcium intake by at least 2–4 hours.',
  },
  {
    id: 'ddi-levothyroxine-calcium',
    moleculeA: 'levothyroxine',
    moleculeB: 'calcium',
    severity: 'MODERATE',
    clinicalReason:
      'Calcium impairs intestinal absorption of Levothyroxine, leading to poorly controlled hypothyroidism.',
    banglaReason:
      'ক্যালসিয়াম থাইরয়েডের ওষুধের কার্যকারিতা কমিয়ে দেয়।',
    recommendation: 'Take Levothyroxine empty stomach morning and Calcium at least 4 hours later.',
  },
  {
    id: 'ddi-domperidone-azithromycin',
    moleculeA: 'domperidone',
    moleculeB: 'azithromycin',
    severity: 'MODERATE',
    clinicalReason:
      'Both Domperidone and Azithromycin prolong cardiac QT interval, increasing arrhythmia risk in elderly patients.',
    banglaReason:
      'ডমপেরিডন ও অ্যাজিথ্রোমাইসিন একসাথে হৃদস্পন্দনের ছন্দপতন (QT prolongation) ঘটাতে পারে।',
    recommendation: 'Use with caution in elderly or cardiac patients; verify necessity.',
  },
  {
    id: 'ddi-ciprofloxacin-doxofylline',
    moleculeA: 'ciprofloxacin',
    moleculeB: 'doxofylline',
    severity: 'MODERATE',
    clinicalReason:
      'Ciprofloxacin reduces xanthine clearance, raising risk of palpitations, tremor, and nausea.',
    banglaReason:
      'সিপ্রোফ্লক্সাসিন ও ডক্সোফাইলিন একসাথে বুক ধড়ফড় ও বমি ভাব বাড়াতে পারে।',
    recommendation: 'Monitor for tachycardia or ask physician for alternative antibiotic.',
  },
  {
    id: 'ddi-nsaid-furosemide',
    moleculeA: 'naproxen',
    moleculeB: 'furosemide',
    severity: 'MODERATE',
    clinicalReason:
      'NSAIDs antagonize Furosemide diuresis and worsen fluid retention and renal perfusion.',
    banglaReason:
      'ন্যাপ্রোক্সেন ফিউরোসেমাইডের প্রস্রাব বাড়ানোর ক্ষমতা কমিয়ে দেয় এবং কিডনিতে চাপ ফেলে।',
    recommendation: 'Avoid NSAIDs in patients taking loop diuretics.',
  },
];

export const COMORBIDITY_CONTRAINDICATIONS: ComorbidityRule[] = [
  {
    id: 'cm-ckd-nsaids',
    comorbidity: 'CKD',
    molecules: ['naproxen', 'diclofenac', 'ketorolac', 'aceclofenac', 'ibuprofen'],
    severity: 'HIGH',
    clinicalReason:
      'NSAIDs pose severe acute kidney injury risk in CKD Stage 3+ patients by constricting afferent renal arterioles.',
    banglaReason:
      'কিডনি রোগীদের জন্য ব্যথার ওষুধ (NSAID) অত্যন্ত ঝুঁকিপূর্ণ — এটি কিডনি দ্রুত বিকল করে দিতে পারে।',
    recommendation:
      'Hold NSAID immediately and ask physician for a renal-safe alternative (e.g., adjusted Paracetamol).',
  },
  {
    id: 'cm-ckd-metformin',
    comorbidity: 'CKD',
    molecules: ['metformin'],
    severity: 'MODERATE',
    clinicalReason:
      'Metformin accumulates in moderate-to-severe renal impairment (eGFR < 30 mL/min), increasing risk of lactic acidosis.',
    banglaReason:
      'কিডনি দুর্বল থাকলে মেটফরমিন রক্তে জমে ল্যাকটিক অ্যাসিডোসিসের ঝুঁকি বাড়াতে পারে।',
    recommendation:
      'Verify latest serum creatinine / eGFR with physician before continuing full dose.',
  },
  {
    id: 'cm-pregnancy-arbs',
    comorbidity: 'PREGNANCY',
    molecules: ['losartan', 'olmesartan'],
    severity: 'HIGH',
    clinicalReason:
      'ARBs (Losartan/Olmesartan) are strictly contraindicated in pregnancy due to severe fetal renal toxicity and teratogenicity.',
    banglaReason:
      'গর্ভাবস্থায় লোসারটান বা অলমেসারটান খাওয়া সম্পূর্ণ নিষিদ্ধ — এটি গর্ভস্থ শিশুর মারাত্মক ক্ষতি করতে পারে।',
    recommendation:
      'Do not take during pregnancy; consult obstetrician for pregnancy-safe antihypertensive.',
  },
  {
    id: 'cm-pregnancy-statins',
    comorbidity: 'PREGNANCY',
    molecules: ['atorvastatin', 'rosuvastatin'],
    severity: 'HIGH',
    clinicalReason:
      'Statins are contraindicated during pregnancy due to disruption of fetal cholesterol synthesis.',
    banglaReason: 'গর্ভাবস্থায় কোলেস্টেরলের স্ট্যাটিন ওষুধ খাওয়া নিষিদ্ধ।',
    recommendation: 'Pause statin therapy and review with physician.',
  },
  {
    id: 'cm-pregnancy-fluoroquinolone',
    comorbidity: 'PREGNANCY',
    molecules: ['ciprofloxacin', 'warfarin', 'ketorolac', 'naproxen', 'diclofenac'],
    severity: 'HIGH',
    clinicalReason:
      'This agent carries documented fetal risk (cartilage toxicity, bleeding, or premature ductus arteriosus closure) in pregnancy.',
    banglaReason: 'গর্ভাবস্থায় এই ওষুধটি মায়ের ও শিশুর জন্য নিরাপদ নয়।',
    recommendation: 'Contact doctor immediately for pregnancy-safe substitute.',
  },
  {
    id: 'cm-pediatric-fluoroquinolone',
    comorbidity: 'PEDIATRIC',
    molecules: ['ciprofloxacin', 'aspirin'],
    severity: 'HIGH',
    clinicalReason:
      'Fluoroquinolones risk pediatric cartilage injury; Aspirin risks Reye syndrome in children under 12.',
    banglaReason:
      '১২ বছরের কম বয়সী শিশুদের জন্য সিপ্রোফ্লক্সাসিন বা অ্যাসপিরিন মারাত্মক ঝুঁকিপূর্ণ।',
    recommendation: 'Confirm pediatric dosing and safer alternative with pediatrician.',
  },
  {
    id: 'cm-asthma-nonselective-bb',
    comorbidity: 'ASTHMA',
    molecules: ['propranolol', 'naproxen', 'diclofenac', 'aspirin', 'ibuprofen'],
    severity: 'HIGH',
    clinicalReason:
      'Non-selective beta blockers (Propranolol) and NSAIDs can precipitate severe bronchospasm in asthma patients.',
    banglaReason:
      'অ্যাজমা রোগীদের ক্ষেত্রে প্রোপ্রানোলল বা NSAID ব্যথার ওষুধ তীব্র শ্বাসকষ্ট সৃষ্টি করতে পারে।',
    recommendation: 'Review with physician before dispensing to an asthma patient.',
  },
  {
    id: 'cm-hepatic-paracetamol-statin',
    comorbidity: 'HEPATIC',
    molecules: ['paracetamol', 'atorvastatin', 'rosuvastatin', 'diclofenac'],
    severity: 'MODERATE',
    clinicalReason:
      'Hepatic impairment reduces clearance of Paracetamol, Statins, and Diclofenac, elevating hepatotoxicity risk.',
    banglaReason:
      'লিভারের সমস্যা থাকলে প্যারাসিটামল বা স্ট্যাটিন বেশি মাত্রায় লিভারের ক্ষতি করতে পারে।',
    recommendation: 'Limit total Paracetamol to ≤2g/day and monitor LFTs.',
  },
  {
    id: 'cm-ulcer-nsaids',
    comorbidity: 'GASTRIC_ULCER',
    molecules: ['naproxen', 'diclofenac', 'ketorolac', 'aceclofenac', 'ibuprofen', 'aspirin'],
    severity: 'HIGH',
    clinicalReason:
      'NSAIDs and Aspirin erode gastric mucosa and can trigger acute peptic ulcer bleeding.',
    banglaReason:
      'গ্যাস্ট্রিক আলসার থাকলে ব্যথার ওষুধ (NSAID) পাকস্থলীতে রক্তপাত ঘটাতে পারে।',
    recommendation: 'Avoid NSAIDs; ensure gastro-protection if antiplatelet is essential.',
  },
  {
    id: 'cm-hypertension-nsaids',
    comorbidity: 'HYPERTENSION',
    molecules: ['naproxen', 'diclofenac', 'ketorolac', 'ibuprofen'],
    severity: 'MODERATE',
    clinicalReason:
      'Regular NSAID use causes sodium retention and elevates systolic blood pressure in hypertensive patients.',
    banglaReason:
      'উচ্চ রক্তচাপ থাকলে নিয়মিত ব্যথার ওষুধ (NSAID) রক্তচাপ আরও বাড়িয়ে দিতে পারে।',
    recommendation: 'Use lowest effective dose for shortest duration and monitor BP.',
  },
];
