import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIGUITY_THRESHOLD,
  doubleMetaphone,
  normalizedLevenshtein,
  resolveMedicationHypotheses,
  scoreDrugCandidate,
} from './grounding';
import { DGDA_DRUG_DATABASE } from '../data/dgdaDatabase';

test('normalizedLevenshtein computes exact character edit similarity', () => {
  assert.equal(normalizedLevenshtein('sergel', 'sergel'), 1);
  const sim = normalizedLevenshtein('srgel', 'sergel');
  assert.ok(sim > 0.8, `Expected >0.8 similarity for srgel/sergel, got ${sim}`);
});

test('doubleMetaphone aligns sound-alike Bangladeshi trade spellings', () => {
  const [p1] = doubleMetaphone('Seclo');
  const [p2] = doubleMetaphone('Seklo');
  assert.equal(p1, p2);

  const [z1] = doubleMetaphone('Zimax');
  const [z2] = doubleMetaphone('Simax');
  assert.equal(z1, z2);
});

test('clinical prior Phi resolves Cap. Srgel 20 1+0+1 a/c to Sergel 20mg Capsule above threshold', () => {
  const result = resolveMedicationHypotheses({
    lineId: 'test-1',
    ocrRaw: 'Cap. Srgel 20',
    hypotheses: ['Cap. Srgel 20', 'Cap. Sergel 20', 'Cap. Seclo 20'],
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
    scheduleShorthand: '1+0+1 a/c 30m for 14 days',
  });

  assert.equal(result.bestCandidate.drug.id, 'dgda-sergel-20');
  assert.ok(
    result.bestCandidate.breakdown.totalScore >= AMBIGUITY_THRESHOLD,
    `Expected score >= ${AMBIGUITY_THRESHOLD}, got ${result.bestCandidate.breakdown.totalScore}`,
  );
  assert.equal(result.requiresHumanVerification, false);
});

test('severe scribble falls below tau=0.78 and triggers Human-in-the-Loop ambiguity alert', () => {
  const result = resolveMedicationHypotheses({
    lineId: 'test-ambig',
    ocrRaw: 'Tab. Mns 10',
    hypotheses: ['Tab. Mns 10', 'Tab. Mnt 10', 'Tab. Mks 10'],
    dosageFormHint: 'Tablet',
    strengthHint: '10mg',
    scheduleShorthand: '0+0+1 HS for 14 days',
  });

  assert.ok(
    result.bestCandidate.breakdown.totalScore < AMBIGUITY_THRESHOLD,
    `Expected ambiguous score < ${AMBIGUITY_THRESHOLD}, got ${result.bestCandidate.breakdown.totalScore}`,
  );
  assert.equal(result.requiresHumanVerification, true);
  assert.ok(result.topCandidates.length >= 2);
});

test('dosage strength prior distinguishes Sergel 20mg from Sergel 40mg', () => {
  const sergel20 = DGDA_DRUG_DATABASE.find((d) => d.id === 'dgda-sergel-20')!;
  const sergel40 = DGDA_DRUG_DATABASE.find((d) => d.id === 'dgda-sergel-40')!;

  const s20 = scoreDrugCandidate('Cap. Sergel 20', sergel20, {
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
    scheduleShorthand: '1+0+1 a/c',
  });
  const s40 = scoreDrugCandidate('Cap. Sergel 20', sergel40, {
    dosageFormHint: 'Capsule',
    strengthHint: '20mg',
    scheduleShorthand: '1+0+1 a/c',
  });

  assert.ok(s20.totalScore > s40.totalScore);
});

test('primary OCR hypothesis Tab. Naprosyn 500 outranks secondary look-alike hypothesis Tab. Napa 500', () => {
  const result = resolveMedicationHypotheses({
    lineId: 'test-naprosyn',
    ocrRaw: 'Tab. Naprosyn 500',
    hypotheses: ['Tab. Naprosyn 500', 'Tab. Napro-A 500', 'Tab. Napa 500'],
    dosageFormHint: 'Tablet',
    strengthHint: '500mg',
    scheduleShorthand: '1+0+1 p/c for 7 days',
  });

  assert.equal(result.bestCandidate.drug.id, 'dgda-naprosyn-500');
  assert.ok(result.bestCandidate.breakdown.totalScore >= AMBIGUITY_THRESHOLD);
});

