import test from 'node:test';
import assert from 'node:assert/strict';
import { DGDA_DRUG_DATABASE } from '../data/dgdaDatabase';
import { compileBanglaSchedule } from './banglaCompiler';
import {
  buildSafetyGraphTrace,
  computePriceTransparency,
  runClinicalSafetyAudit,
  verifyBlisterAgainstPrescription,
} from './safetyGraph';
import type { DecodedMedication } from '../types/clinical';

function makeDecoded(drugId: string, shorthand = '1+0+1 p/c for 10 days'): DecodedMedication {
  const drug = DGDA_DRUG_DATABASE.find((d) => d.id === drugId)!;
  return {
    lineId: `line-${drugId}`,
    ocrRaw: `${drug.brandName} ${drug.strengthText}`,
    hypotheses: [`${drug.brandName} ${drug.strengthText}`],
    scheduleShorthand: shorthand,
    resolvedDrug: drug,
    groundingScore: 0.96,
    scoreBreakdown: {
      denseCosine: 0.98,
      levenshteinNorm: 0.95,
      phoneticMatch: 1,
      clinicalPrior: 0.92,
      totalScore: 0.96,
      matchedHypothesis: drug.brandName,
    },
    topCandidates: [],
    requiresHumanVerification: false,
    humanConfirmed: true,
    compiledSchedule: compileBanglaSchedule(drug, shorthand),
  };
}

test('detects silent duplicate active generic across different Bangladeshi trade brands', () => {
  const meds = [
    makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days'),
    makeDecoded('dgda-maxpro-20', '1+0+0 a/c for 14 days'),
  ];
  const alerts = runClinicalSafetyAudit(meds, []);
  const dup = alerts.find((a) => a.alertType === 'DUPLICATE_GENERIC');
  assert.ok(dup, 'Expected DUPLICATE_GENERIC alert for Sergel + Maxpro (both Esomeprazole)');
  assert.equal(dup.severity, 'HIGH');
});

test('detects CKD NSAID contraindication and Clopidogrel+Omeprazole CYP2C19 DDI', () => {
  const meds = [
    makeDecoded('dgda-naprosyn-500'),
    makeDecoded('dgda-anclog-75'),
    makeDecoded('dgda-seclo-20'),
  ];
  const alerts = runClinicalSafetyAudit(meds, ['CKD']);
  assert.ok(
    alerts.some((a) => a.alertType === 'COMORBIDITY_CONTRAINDICATION' && a.drugInvolved.includes('Naprosyn')),
  );
  assert.ok(
    alerts.some((a) => a.alertType === 'DRUG_DRUG_INTERACTION' && a.clinicalReason.includes('CYP2C19')),
  );
});

test('blister verifier distinguishes Exact Match, Bio-Equivalent, and Critical Wrong-Strength Mismatch', () => {
  const prescribed = [makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days')];

  const mismatch = verifyBlisterAgainstPrescription('Cap. Sergel 40mg', prescribed, {
    dosageFormHint: 'Capsule',
    strengthHint: '40mg',
  });
  assert.equal(mismatch.status, 'CRITICAL_MISMATCH');
  assert.ok(mismatch.alertBangla.includes('২০ মিলিগ্রাম'));
  assert.ok(mismatch.alertBangla.includes('৪০ মিলিগ্রাম'));

  const bioEq = verifyBlisterAgainstPrescription('Cap. Exium 20mg', prescribed, {
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
  });
  assert.equal(bioEq.status, 'BIO_EQUIVALENT');

  const exact = verifyBlisterAgainstPrescription('Cap. Sergel 20mg', prescribed, {
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
  });
  assert.equal(exact.status, 'EXACT_MATCH');
});

test('computes statutory DGDA MRP total and cheaper bio-equivalent savings', () => {
  const meds = [
    makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days'), // 28 * 7 = 196 BDT (Exium is 5 BDT -> 140 BDT)
    makeDecoded('dgda-naprosyn-500', '1+0+1 p/c for 7 days'), // 14 * 12 = 168 BDT (Xenole is 8.5 -> 119 BDT)
  ];
  const report = computePriceTransparency(meds);
  assert.equal(report.totalStatutoryMrpBdt, 364);
  assert.ok(report.potentialSavingsBdt > 90);
  assert.ok(report.potentialSavingsPercent >= 25);
});

test('buildSafetyGraphTrace produces canonical molecule vertices and conflict edges', () => {
  const meds = [
    makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days'),
    makeDecoded('dgda-maxpro-20', '1+0+0 a/c for 14 days'),
    makeDecoded('dgda-naprosyn-500', '1+0+1 p/c for 7 days'),
    makeDecoded('dgda-anclog-75', '0+1+0 p/c for 30 days'),
    makeDecoded('dgda-seclo-20', '1+0+1 a/c for 30 days'),
  ];
  const alerts = runClinicalSafetyAudit(meds, ['CKD']);
  const trace = buildSafetyGraphTrace(meds, alerts);

  assert.equal(trace.resolvedNodes.length, 5);
  assert.equal(trace.moleculeCount, 4); // Esomeprazole shared by Sergel & Maxpro
  assert.ok(trace.conflictEdges.some((e) => e.relation.startsWith('SAME MOLECULE')));
  assert.ok(trace.conflictEdges.some((e) => e.relation === 'DDI INTERACTION'));
  assert.ok(trace.conflictEdges.some((e) => e.relation === 'CONTRAINDICATED IN'));
});

test('Challenge 1: detects cross-visit duplicate generic and cross-visit DDI across different clinics', () => {
  const clinicASergel: DecodedMedication = {
    ...makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days'),
    lineId: 'v1-sergel',
    visitId: 'visit-clinic-a',
    visitLabel: 'Clinic A · Medicine',
    visitDate: '20 Nov 2026',
  };
  const clinicAAnclog: DecodedMedication = {
    ...makeDecoded('dgda-anclog-75', '0+1+0 p/c for 30 days'),
    lineId: 'v1-anclog',
    visitId: 'visit-clinic-a',
    visitLabel: 'Clinic A · Medicine',
    visitDate: '20 Nov 2026',
  };
  const clinicBMaxpro: DecodedMedication = {
    ...makeDecoded('dgda-maxpro-20', '1+0+1 a/c for 14 days'),
    lineId: 'v2-maxpro',
    visitId: 'visit-clinic-b',
    visitLabel: 'Clinic B · Ortho',
    visitDate: '24 Nov 2026',
  };
  const clinicBSeclo: DecodedMedication = {
    ...makeDecoded('dgda-seclo-20', '1+0+0 a/c for 14 days'),
    lineId: 'v2-seclo',
    visitId: 'visit-clinic-b',
    visitLabel: 'Clinic B · Ortho',
    visitDate: '24 Nov 2026',
  };

  const alerts = runClinicalSafetyAudit(
    [clinicASergel, clinicAAnclog, clinicBMaxpro, clinicBSeclo],
    [],
  );

  const crossDup = alerts.find((a) => a.alertType === 'DUPLICATE_GENERIC' && a.isCrossVisit);
  assert.ok(crossDup, 'Expected cross-visit DUPLICATE_GENERIC between Clinic A Sergel & Clinic B Maxpro');
  assert.ok(crossDup.clinicalReason.includes('Cross-Visit Conflict'));
  assert.ok(crossDup.clinicalReason.includes('Clinic A · Medicine'));
  assert.ok(crossDup.clinicalReason.includes('Clinic B · Ortho'));
  assert.equal(crossDup.visitsInvolved?.length, 2);

  const crossDdi = alerts.find((a) => a.alertType === 'DRUG_DRUG_INTERACTION' && a.isCrossVisit);
  assert.ok(crossDdi, 'Expected cross-visit DDI between Clinic A Anclog & Clinic B Seclo');
  assert.ok(crossDdi.clinicalReason.includes('Cross-Visit Interaction'));
});

test('Challenge 2: holds red mismatch alert (UNREADABLE_FOIL) on damaged/cropped foil while preserving true mismatches', () => {
  const prescribed = [makeDecoded('dgda-sergel-20', '1+0+1 a/c for 14 days')];

  // Damaged / scissor-cut foil with unreadable OCR
  const damaged = verifyBlisterAgainstPrescription('..rg.. ?0m..', prescribed, {
    readability: 'UNREADABLE',
    isCroppedOrDamaged: true,
    ocrConfidence: 0.24,
    readabilityReason: 'cut across the brand name with heavy metallic glare',
  });
  assert.equal(damaged.status, 'UNREADABLE_FOIL');
  assert.equal(damaged.dispensedDrug, null);
  assert.ok(damaged.reasonEnglish.includes('red mismatch alert withheld'));

  // Low-confidence illegible gibberish typed manually
  const illegibleManual = verifyBlisterAgainstPrescription('x?##..', prescribed);
  assert.equal(illegibleManual.status, 'UNREADABLE_FOIL');
  assert.equal(illegibleManual.dispensedDrug, null);

  // Clearly readable contradictory strip STILL fires CRITICAL_MISMATCH red alert
  const realMismatch = verifyBlisterAgainstPrescription('Cap. Sergel 40mg', prescribed, {
    dosageFormHint: 'Capsule',
    strengthHint: '40mg',
    readability: 'CLEAR',
    ocrConfidence: 0.96,
  });
  assert.equal(realMismatch.status, 'CRITICAL_MISMATCH');
  assert.ok(realMismatch.dispensedDrug !== null);
});

