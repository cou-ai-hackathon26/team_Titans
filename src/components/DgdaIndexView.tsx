import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import { AMBIGUITY_THRESHOLD, RANKING_WEIGHTS, searchDgdaHybrid } from '../engine/grounding';
import type { SavedScanRecord } from '../types/clinical';

interface DgdaIndexViewProps {
  lang: 'en' | 'bn';
  savedScans: SavedScanRecord[];
  onLoadSavedScan: (scan: SavedScanRecord) => void;
  onDeleteSavedScan: (prescriptionId: string) => void;
}

export const DgdaIndexView: React.FC<DgdaIndexViewProps> = ({
  lang,
  savedScans,
  onLoadSavedScan,
  onDeleteSavedScan,
}) => {
  const [query, setQuery] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [formHint, setFormHint] = useState<string>('');
  const [strengthHint, setStrengthHint] = useState<string>('');
  const [scheduleHint, setScheduleHint] = useState<string>('');

  const results = useMemo(
    () =>
      searchDgdaHybrid(query || 'Sergel 20', {
        dosageFormHint: formHint || undefined,
        strengthHint: strengthHint || undefined,
        scheduleShorthand: scheduleHint || undefined,
        limit: 10,
      }),
    [query, formHint, strengthHint, scheduleHint],
  );

  return (
    <div className="space-y-10">
      {/* Clean Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {lang === 'bn' ? 'ওষুধ খুঁজুন ও সংরক্ষিত তালিকা' : 'Medicine Lookup'}
        </h1>
        <p className="text-sm text-slate-500 max-w-lg">
          {lang === 'bn'
            ? 'যেকোনো বাংলাদেশি ওষুধের নাম লিখে সরকারি দাম ও মূল উপাদান দেখুন।'
            : 'Search Bangladeshi medicines by brand or rough spelling to check official prices and active ingredients.'}
        </p>
      </div>

      {/* Simple Search Card */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="medicine-search-input"
            type="text"
            aria-label="Search medicine name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a medicine name (e.g. Sergel 20, Napa 500, Seclo, Monas)..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 mr-1">Try:</span>
            {['Srgel 20', 'Seklo 20', 'Napa 500', 'Naprosin 500'].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-expanded={showTechnicalDetails}
            onClick={() => setShowTechnicalDetails((v) => !v)}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <span>Technical match details</span>
            {showTechnicalDetails ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Optional Stage 3 Technical Filters & Formula */}
        {showTechnicalDetails && (
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">
                Stage 3 Hybrid Grounding (τ = {AMBIGUITY_THRESHOLD.toFixed(2)})
              </span>
              <code className="font-mono text-[11px] text-slate-600">
                S = {RANKING_WEIGHTS.alpha}·cos + {RANKING_WEIGHTS.beta}·Lev +{' '}
                {RANKING_WEIGHTS.gamma}·Phon + {RANKING_WEIGHTS.delta}·Φ(f,s,t)
              </code>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                aria-label="Dosage form filter"
                value={formHint}
                onChange={(e) => setFormHint(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="">Any Form</option>
                <option value="Capsule">Capsule</option>
                <option value="Tablet">Tablet</option>
                <option value="Syrup">Syrup</option>
                <option value="Suspension">Suspension</option>
              </select>
              <input
                type="text"
                aria-label="Strength filter"
                value={strengthHint}
                onChange={(e) => setStrengthHint(e.target.value)}
                placeholder="Strength (e.g. 20mg)"
                className="px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800"
              />
              <select
                aria-label="Meal timing filter"
                value={scheduleHint}
                onChange={(e) => setScheduleHint(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="">Any Timing</option>
                <option value="1+0+1 a/c">Before meals (a/c)</option>
                <option value="1+0+1 p/c">After meals (p/c)</option>
                <option value="0+0+1 HS">Bedtime (HS)</option>
              </select>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-medium text-slate-400">
                <th className="py-2.5 px-3.5">Medicine</th>
                <th className="py-2.5 px-3.5">Ingredient &amp; Company</th>
                {showTechnicalDetails && (
                  <>
                    <th className="py-2.5 px-2.5 text-right">cos</th>
                    <th className="py-2.5 px-2.5 text-right">Lev</th>
                    <th className="py-2.5 px-2.5 text-right">Phon</th>
                    <th className="py-2.5 px-2.5 text-right">Φ</th>
                    <th className="py-2.5 px-2.5 text-right">Score</th>
                  </>
                )}
                <th className="py-2.5 px-3.5 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((item, idx) => (
                <tr key={item.drug.id} className={idx === 0 ? 'bg-teal-50/30' : ''}>
                  <td className="py-2.5 px-3.5">
                    <div className="font-semibold text-slate-900">
                      {item.drug.brandName} {item.drug.strengthText}
                    </div>
                    <div className="text-xs text-slate-400 font-bangla">
                      {item.drug.banglaName} · {item.drug.dosageForm}
                    </div>
                  </td>
                  <td className="py-2.5 px-3.5">
                    <div className="text-slate-700 text-xs sm:text-sm">
                      {item.drug.activeGenericDisplay}
                    </div>
                    <div className="text-xs text-slate-400">{item.drug.manufacturer}</div>
                  </td>
                  {showTechnicalDetails && (
                    <>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-xs text-slate-500">
                        {item.breakdown.denseCosine.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-xs text-slate-500">
                        {item.breakdown.levenshteinNorm.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-xs text-slate-500">
                        {item.breakdown.phoneticMatch.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-xs text-slate-500">
                        {item.breakdown.clinicalPrior.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-xs font-semibold text-teal-800">
                        {item.breakdown.totalScore.toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-xs sm:text-sm text-slate-800 whitespace-nowrap">
                    ৳{item.drug.unitMrpBdt.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Saved Prescriptions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">
              {lang === 'bn' ? 'সংরক্ষিত প্রেসক্রিপশন' : 'Saved Prescriptions'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">{savedScans.length} saved</span>
        </div>

        {savedScans.length === 0 ? (
          <div className="py-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
            No saved prescriptions yet. Tap &ldquo;Save&rdquo; on any prescription to keep it on
            this device.
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
            {savedScans.map((scan) => (
              <div
                key={scan.prescriptionId}
                className="p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900">
                    {scan.patientContext.patientName || 'Saved Prescription'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {scan.medications.length} medicines ·{' '}
                    {new Date(scan.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadSavedScan(scan)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer"
                  >
                    Open
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete saved prescription ${scan.prescriptionId}`}
                    onClick={() => onDeleteSavedScan(scan.prescriptionId)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
