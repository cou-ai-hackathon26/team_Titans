import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  ArrowRight,
  GitBranch,
  ScanLine,
} from 'lucide-react';
import { formatDrugLabel } from '../data/dgdaDatabase';
import { AMBIGUITY_THRESHOLD, RANKING_WEIGHTS } from '../engine/grounding';
import { buildSafetyGraphTrace } from '../engine/safetyGraph';
import type {
  BlisterVerificationResult,
  ClinicalAlert,
  DecodedMedication,
  PatientContext,
  PrescriptionPipelinePayload,
} from '../types/clinical';

interface PipelineInspectorProps {
  prescriptionId: string;
  patientContext: PatientContext;
  medications: DecodedMedication[];
  clinicalAlerts: ClinicalAlert[];
  blisterChecks: BlisterVerificationResult[];
  pipelinePayload: PrescriptionPipelinePayload;
  originalImageUrl: string | null;
  sauvolaImageUrl: string | null;
  onGoToBlister: () => void;
}

type StageTab = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'stage6';
type DocViewMode = 'zones' | 'sauvola' | 'original';

const STAGE_TABS: Array<{ id: StageTab; label: string }> = [
  { id: 'stage1', label: '1 · Pre-Process' },
  { id: 'stage2', label: '2 · VLM Extract' },
  { id: 'stage3', label: '3 · Grounding' },
  { id: 'stage4', label: '4 · Blister CV' },
  { id: 'stage5', label: '5 · Safety Graph' },
  { id: 'stage6', label: '6 · Bangla & JSON' },
];

export const PipelineInspector: React.FC<PipelineInspectorProps> = ({
  prescriptionId,
  patientContext,
  medications,
  clinicalAlerts,
  blisterChecks,
  pipelinePayload,
  originalImageUrl,
  sauvolaImageUrl,
  onGoToBlister,
}) => {
  const [activeStage, setActiveStage] = useState<StageTab>('stage1');
  const [docViewMode, setDocViewMode] = useState<DocViewMode>('zones');
  const [jsonCopied, setJsonCopied] = useState(false);

  const ambiguousMeds = useMemo(
    () => medications.filter((m) => m.requiresHumanVerification && !m.humanConfirmed),
    [medications],
  );

  const graphTrace = useMemo(
    () => buildSafetyGraphTrace(medications, clinicalAlerts),
    [medications, clinicalAlerts],
  );

  const displayedImage =
    docViewMode === 'sauvola' && sauvolaImageUrl ? sauvolaImageUrl : originalImageUrl;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pipelinePayload, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(pipelinePayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prescriptionId || 'oshudhguard'}-pipeline.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="6-Stage Neuro-Symbolic Architecture Inspector"
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
    >
      {/* Stage Navigation Strip */}
      <div className="border-b border-slate-200 px-4 sm:px-6 overflow-x-auto">
        <div role="tablist" aria-label="Architecture pipeline stages" className="flex items-center gap-6">
          {STAGE_TABS.map((tab) => {
            const selected = activeStage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveStage(tab.id)}
                className={`relative py-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selected ? 'text-teal-800' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
                {selected && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-700" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage Body */}
      <div className="p-5 sm:p-6">
        {/* STAGE 1: Document Pre-Processing, Sauvola Thresholding & Zone A/B/C */}
        {activeStage === 'stage1' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">
                  Sauvola Adaptive Local Thresholding &amp; Zone Segmentation
                </div>
                <div
                  role="group"
                  aria-label="Document view filter"
                  className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg"
                >
                  {(
                    [
                      { id: 'zones', label: 'Zones A/B/C' },
                      { id: 'sauvola', label: 'Sauvola Ink' },
                      { id: 'original', label: 'Original' },
                    ] as Array<{ id: DocViewMode; label: string }>
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={docViewMode === mode.id}
                      onClick={() => setDocViewMode(mode.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        docViewMode === mode.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {displayedImage ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={displayedImage}
                    alt="Pre-processed prescription document"
                    referrerPolicy="no-referrer"
                    className="w-full h-auto block"
                  />
                  {docViewMode === 'zones' && (
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
                      <div
                        className="absolute border-2 border-sky-600/80 bg-sky-500/5 rounded"
                        style={{ top: '12.6%', left: '3.8%', width: '92.4%', height: '17.3%' }}
                      >
                        <span className="absolute right-0 top-0 bg-sky-700 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-bl">
                          Zone A · Diagnosis Notes
                        </span>
                      </div>
                      <div
                        className="absolute border-2 border-teal-700/80 bg-teal-500/5 rounded"
                        style={{ top: '36.2%', left: '27%', width: '37.5%', height: '52%' }}
                      >
                        <span className="inline-block bg-teal-700 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-br">
                          Zone B · Rx Block
                        </span>
                      </div>
                      <div
                        className="absolute border-2 border-amber-600/80 bg-amber-500/5 rounded"
                        style={{ top: '36.2%', left: '65.2%', width: '31%', height: '52%' }}
                      >
                        <span className="inline-block bg-amber-700 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-br">
                          Zone C · Schedule
                        </span>
                      </div>
                      {ambiguousMeds.map((med) =>
                        med.bbox ? (
                          <div
                            key={med.lineId}
                            className="absolute border-2 border-red-600 bg-red-500/15 rounded"
                            style={{
                              top: `${med.bbox[0] / 10}%`,
                              left: `${med.bbox[1] / 10}%`,
                              height: `${(med.bbox[2] - med.bbox[0]) / 10}%`,
                              width: `${(med.bbox[3] - med.bbox[1]) / 10}%`,
                            }}
                          >
                            <span className="inline-block bg-red-700 text-white text-[10px] font-mono px-1.5 py-0.5">
                              S={med.groundingScore.toFixed(2)} &lt; 0.78
                            </span>
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                  Upload or capture a prescription photo to inspect Stage 1 Sauvola binarization and
                  structural zones.
                </div>
              )}
            </div>

            <div className="md:col-span-5 space-y-4 text-xs text-slate-600">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900">Structural Zone Isolation</div>
                <p className="leading-relaxed">
                  Applies integral-image Sauvola adaptive local thresholding to preserve thin doctor
                  pen strokes under uneven pharmacy lighting, then isolates three clinical regions:
                </p>
              </div>
              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                <div className="p-3">
                  <dt className="font-semibold text-sky-800">Zone A · Header &amp; Diagnosis</dt>
                  <dd className="mt-1 text-slate-700">
                    {patientContext.detectedConditions.length > 0
                      ? patientContext.detectedConditions.join(' · ')
                      : 'No diagnosis annotations detected'}
                  </dd>
                </div>
                <div className="p-3">
                  <dt className="font-semibold text-teal-800">Zone B · Rx Medication Block</dt>
                  <dd className="mt-1 font-mono tabular-nums text-slate-700">
                    {medications.length} medicine lines isolated with bounding boxes
                  </dd>
                </div>
                <div className="p-3">
                  <dt className="font-semibold text-amber-800">Zone C · Schedule &amp; Duration</dt>
                  <dd className="mt-1 font-mono text-slate-700">
                    {medications.map((m) => m.scheduleShorthand).join(' · ')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* STAGE 2: Multimodal VLM Top-3 Visual Hypotheses */}
        {activeStage === 'stage2' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              Instead of committing to a single fragile OCR guess, Stage 2 emits top-3 visual
              transcription hypotheses alongside dosage form (f), strength (s), and meal-timing
              shorthand (t).
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Raw Ink OCR</th>
                    <th className="py-2.5 px-3">Top-3 VLM Hypotheses</th>
                    <th className="py-2.5 px-3">Form (f)</th>
                    <th className="py-2.5 px-3">Strength (s)</th>
                    <th className="py-2.5 px-3">Schedule (t)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((med) => (
                    <tr key={med.lineId}>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {med.ocrRaw}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {med.hypotheses.join(' → ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {med.dosageFormHint || med.resolvedDrug.dosageForm}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                        {med.strengthHint || med.resolvedDrug.strengthText}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {med.scheduleShorthand}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAGE 3: Zero-Hallucination Hybrid Entity Resolution S(q, c) */}
        {activeStage === 'stage3' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Multi-factor grounding against indexed Bangladeshi DGDA registry (fail-safe
                threshold τ = {AMBIGUITY_THRESHOLD.toFixed(2)}):
              </span>
              <code className="font-mono text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                S(q,c) = {RANKING_WEIGHTS.alpha}·cos + {RANKING_WEIGHTS.beta}·Lev +{' '}
                {RANKING_WEIGHTS.gamma}·Phon + {RANKING_WEIGHTS.delta}·Φ(f,s,t)
              </code>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">OCR Line</th>
                    <th className="py-2.5 px-3">Resolved DGDA Brand</th>
                    <th className="py-2.5 px-3 text-right">cos</th>
                    <th className="py-2.5 px-3 text-right">Lev</th>
                    <th className="py-2.5 px-3 text-right">Phon</th>
                    <th className="py-2.5 px-3 text-right">Φ Prior</th>
                    <th className="py-2.5 px-3 text-right">S(q,c)</th>
                    <th className="py-2.5 px-3">Gate (τ=0.78)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((med) => {
                    const b = med.scoreBreakdown;
                    const needsConfirm = med.requiresHumanVerification && !med.humanConfirmed;
                    return (
                      <tr key={med.lineId}>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{med.ocrRaw}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {formatDrugLabel(med.resolvedDrug)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {b.denseCosine.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {b.levenshteinNorm.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {b.phoneticMatch.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {b.clinicalPrior.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {med.groundingScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {needsConfirm ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                              Abstained
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              {med.requiresHumanVerification ? 'Human Verified' : 'Auto-Grounded'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAGE 4: Physical Blister-Strip Verifier Summary */}
        {activeStage === 'stage4' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 max-w-xl">
                Applies CIE-LAB Luminance CLAHE to suppress metallic foil glare and runs bipartite
                matching against the active prescription set to catch wrong-strength or wrong-drug
                loose strips.
              </div>
              <button
                type="button"
                onClick={onGoToBlister}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <ScanLine className="w-3.5 h-3.5" aria-hidden="true" />
                Open Blister Verifier
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {blisterChecks.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                No physical blister strips checked in this session yet. Open the Verify Strip tab to
                scan a metallic foil strip or run a test strip.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                {blisterChecks.map((chk) => (
                  <div key={chk.stripId} className="p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900">{chk.dispensedOnStrip}</span>
                      <span className="text-slate-400 mx-1.5">vs.</span>
                      <span className="text-slate-600">{chk.prescribedItem}</span>
                    </div>
                    <span
                      className={`font-semibold ${
                        chk.status === 'UNREADABLE_FOIL'
                          ? 'text-slate-600'
                          : chk.status === 'CRITICAL_MISMATCH'
                            ? 'text-red-700'
                            : chk.status === 'BIO_EQUIVALENT'
                              ? 'text-amber-800'
                              : 'text-emerald-700'
                      }`}
                    >
                      {chk.status === 'UNREADABLE_FOIL'
                        ? 'UNREADABLE FOIL (ABSTAINED)'
                        : chk.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STAGE 5: Active-Molecule Clinical Safety Graph G = (V, E) */}
        {activeStage === 'stage5' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Knowledge Graph G = (V, E) traversal across canonical active molecules and active
                patient comorbidities.
              </span>
              <span className="font-mono tabular-nums text-slate-800">
                {graphTrace.resolvedNodes.length} Brands → {graphTrace.moleculeCount} Canonical
                Molecules · {graphTrace.conflictEdges.length} Conflict Edges
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-900">
                  Brand → Canonical Molecule Mapping
                </div>
                <ul className="space-y-2 text-xs">
                  {graphTrace.resolvedNodes.map((node, i) => (
                    <li key={`${node.brand}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {node.brand}
                        {node.visitLabel ? (
                          <span className="text-slate-400 font-normal ml-1">[{node.visitLabel}]</span>
                        ) : null}
                      </span>
                      <span className="font-mono text-teal-800">→ {node.molecules.join(' + ')}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <GitBranch className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  Triggered Conflict Edges
                </div>
                {graphTrace.conflictEdges.length === 0 ? (
                  <p className="text-xs text-emerald-700">
                    No duplicate, DDI, or contraindication edges triggered in G = (V, E).
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {graphTrace.conflictEdges.map((edge) => (
                      <li
                        key={edge.id}
                        className={`p-2.5 rounded-lg border ${
                          edge.severity === 'HIGH'
                            ? 'border-red-200 bg-red-50/60 text-red-950'
                            : 'border-amber-200 bg-amber-50/60 text-amber-950'
                        }`}
                      >
                        <div className="font-mono text-[11px] font-semibold">
                          {edge.sourceLabel} —[{edge.relation}]→ {edge.targetLabel}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STAGE 6: Deterministic Bangla Compiler & Structured Pipeline JSON Payload */}
        {activeStage === 'stage6' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Deterministic zero-hallucination Bangla schedule compiler &amp; structured pipeline
                JSON output payload.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  {jsonCopied ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Export JSON
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
              {JSON.stringify(pipelinePayload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
};
