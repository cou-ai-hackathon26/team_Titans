import test from 'node:test';
import assert from 'node:assert/strict';
import { DGDA_DRUG_DATABASE } from '../data/dgdaDatabase';
import { compileBanglaSchedule, toBanglaDigits } from './banglaCompiler';

test('toBanglaDigits converts ASCII numbers cleanly', () => {
  assert.equal(toBanglaDigits('20mg 14'), '২০mg ১৪');
});

test('compiles 1+0+1 a/c 30m for 14 days deterministically into natural Bangla', () => {
  const sergel20 = DGDA_DRUG_DATABASE.find((d) => d.id === 'dgda-sergel-20')!;
  const compiled = compileBanglaSchedule(sergel20, '1+0+1 a/c 30m for 14 days');

  assert.equal(compiled.morning, 1);
  assert.equal(compiled.noon, 0);
  assert.equal(compiled.night, 1);
  assert.equal(compiled.mealTiming, 'before_meal');
  assert.equal(compiled.mealOffsetMinutes, 30);
  assert.equal(compiled.durationDays, 14);
  assert.equal(compiled.totalUnits, 28);
  assert.ok(compiled.banglaVoiceText.includes('সার্জেল ২০ মিলিগ্রাম'));
  assert.ok(compiled.banglaVoiceText.includes('সকালে ও রাতে'));
  assert.ok(compiled.banglaVoiceText.includes('খাবারের ৩০ মিনিট আগে'));
  assert.ok(compiled.banglaVoiceText.includes('ক্যাপসুল'));
});

test('compiles Latin clinical shorthand TDS, BD, HS, and SOS accurately', () => {
  const napa = DGDA_DRUG_DATABASE.find((d) => d.id === 'dgda-napa-500')!;
  const tds = compileBanglaSchedule(napa, 'TDS p/c 5d');
  assert.equal(tds.morning, 1);
  assert.equal(tds.noon, 1);
  assert.equal(tds.night, 1);
  assert.equal(tds.durationDays, 5);
  assert.equal(tds.totalUnits, 15);

  const sos = compileBanglaSchedule(napa, 'SOS p/c');
  assert.equal(sos.asNeeded, true);
  assert.ok(sos.banglaVoiceText.includes('প্রয়োজনে'));

  const monas = DGDA_DRUG_DATABASE.find((d) => d.id === 'dgda-monas-10')!;
  const hs = compileBanglaSchedule(monas, '0+0+1 HS for 14 days');
  assert.ok(hs.banglaVoiceText.includes('রাতে ঘুমানোর আগে'));
  assert.ok(!hs.banglaVoiceText.includes('রাতে রাতে'));
});

