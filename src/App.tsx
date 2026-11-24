import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopBar, type ActiveTab } from './components/TopBar';
import { ScannerWorkspace } from './components/ScannerWorkspace';
import { BlisterVerifier } from './components/BlisterVerifier';
import { CaregiverCardView } from './components/CaregiverCardView';
import { DgdaIndexView } from './components/DgdaIndexView';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import {
  DEMO_PRESCRIPTION_CASES,
  type DemoBlisterFixture,
  type DemoPrescriptionCase,
} from './data/demoCases';
import { compileBanglaSchedule } from './engine/banglaCompiler';
import { resolveMedicationHypotheses } from './engine/grounding';
import {
  applyClaheFoilFilter,
  applySauvolaThreshold,
  cropRegionDataUrl,
  renderDemoBlisterCanvas,
  renderDemoPrescriptionCanvas,
} from './engine/imageProcessing';
import {
  buildPipelineJsonPayload,
  computePriceTransparency,
  detectComorbiditiesFromNotes,
  runClinicalSafetyAudit,
  verifyBlisterAgainstPrescription,
} from './engine/safetyGraph';
import {
  deleteSavedScanOffline,
  loadSavedScansOffline,
  saveScanOffline,
} from './utils/storage';
import { speakBanglaText, stopBanglaSpeech } from './utils/voice';
import type {
  BlisterReadability,
  BlisterVerificationResult,
  ComorbidityId,
  DecodedMedication,
  DgdaDrugRecord,
  PatientContext,
  PrescriptionVisit,
  RawVlmMedicationLine,
  SavedScanRecord,
} from './types/clinical';

function formatTodayShort(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function decodeRawLinesWithCrops(
  rawLines: RawVlmMedicationLine[],
  sourceImageDataUrl?: string,
  visitMeta?: { visitId: string; visitLabel: string; visitDate: string },
): Promise<DecodedMedication[]> {
  return Promise.all(
    rawLines.map(async (line) => {
      const resolved = resolveMedicationHypotheses(line);
      const chosenDrug = resolved.bestCandidate.drug;
      const compiled = compileBanglaSchedule(
        chosenDrug,
        line.scheduleShorthand,
        line.durationDays,
      );

      let croppedInkDataUrl: string | undefined;
      if (sourceImageDataUrl && line.bbox) {
        try {
          croppedInkDataUrl = await cropRegionDataUrl(sourceImageDataUrl, line.bbox);
        } catch {
          croppedInkDataUrl = undefined;
        }
      }

      return {
        lineId: line.lineId,
        ocrRaw: line.ocrRaw,
        hypotheses: line.hypotheses,
        dosageFormHint: line.dosageFormHint,
        strengthHint: line.strengthHint,
        scheduleShorthand: line.scheduleShorthand,
        bbox: line.bbox,
        croppedInkDataUrl,
        visitId: visitMeta?.visitId,
        visitLabel: visitMeta?.visitLabel,
        visitDate: visitMeta?.visitDate,
        resolvedDrug: chosenDrug,
        groundingScore: resolved.bestCandidate.breakdown.totalScore,
        scoreBreakdown: resolved.bestCandidate.breakdown,
        topCandidates: resolved.topCandidates,
        requiresHumanVerification: resolved.requiresHumanVerification,
        humanConfirmed: !resolved.requiresHumanVerification,
        compiledSchedule: compiled,
      };
    }),
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [lang, setLang] = useState<'en' | 'bn'>('en');
  const [cameraMode, setCameraMode] = useState<'rx' | 'rx-visit' | 'blister' | null>(null);
  const [pendingVisitMeta, setPendingVisitMeta] = useState<{
    clinicName?: string;
    visitDate?: string;
  } | null>(null);

  // Core prescription session state (supports 1 or multiple clinic visits)
  const [prescriptionId, setPrescriptionId] = useState<string>('');
  const [visits, setVisits] = useState<PrescriptionVisit[]>([]);
  const [patientContext, setPatientContext] = useState<PatientContext>({
    detectedConditions: [],
    activeComorbidities: [],
  });
  const [medications, setMedications] = useState<DecodedMedication[]>([]);
  const [blisterChecks, setBlisterChecks] = useState<BlisterVerificationResult[]>([]);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [sauvolaImageUrl, setSauvolaImageUrl] = useState<string | null>(null);

  // Loading, error, voice, and offline cache state
  const [isProcessingRx, setIsProcessingRx] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);
  const [lastUploadedRxAction, setLastUploadedRxAction] = useState<{
    file: File;
    appendAsNewVisit?: boolean;
    clinicNameOverride?: string;
    visitDateOverride?: string;
  } | null>(null);
  const [isVerifyingBlister, setIsVerifyingBlister] = useState(false);
  const [blisterError, setBlisterError] = useState<string | null>(null);
  const [lastUploadedBlisterFile, setLastUploadedBlisterFile] = useState<File | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [savedScans, setSavedScans] = useState<SavedScanRecord[]>([]);
  const [justSavedOffline, setJustSavedOffline] = useState(false);

  // Load offline IndexedDB saved scans on mount
  useEffect(() => {
    loadSavedScansOffline().then(setSavedScans);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => stopBanglaSpeech();
  }, []);

  // Ensure tab switches always land cleanly at the top of the viewport
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  // Reactive Stage 5 Clinical Safety Audit (automatically spans all active clinic visits)
  const clinicalAlerts = useMemo(
    () => runClinicalSafetyAudit(medications, patientContext.activeComorbidities),
    [medications, patientContext.activeComorbidities],
  );

  // Reactive Stage 5 DGDA Official MRP & Generic Price Transparency Report
  const priceReport = useMemo(() => computePriceTransparency(medications), [medications]);

  // Reactive Page 6 Sample Pipeline JSON Output Payload
  const pipelinePayload = useMemo(
    () =>
      buildPipelineJsonPayload(
        prescriptionId || 'COU-RX-NEW',
        patientContext,
        medications,
        blisterChecks,
        clinicalAlerts,
        visits,
      ),
    [prescriptionId, patientContext, medications, blisterChecks, clinicalAlerts, visits],
  );

  const handleLoadDemoCase = useCallback(async (demo: DemoPrescriptionCase) => {
    stopBanglaSpeech();
    setSpeakingId(null);
    setRxError(null);
    setBlisterError(null);
    setLastUploadedRxAction(null);
    setIsProcessingRx(true);
    setJustSavedOffline(false);

    try {
      const visitId = `visit-${demo.id}`;
      const renderedRx = renderDemoPrescriptionCanvas(demo);
      const [sauvola, decoded] = await Promise.all([
        applySauvolaThreshold(renderedRx),
        decodeRawLinesWithCrops(demo.rawLines, renderedRx, {
          visitId,
          visitLabel: demo.clinicName,
          visitDate: demo.visitDate,
        }),
      ]);

      setPrescriptionId(demo.prescriptionId);
      setVisits([
        {
          visitId,
          prescriptionId: demo.prescriptionId,
          clinicName: demo.clinicName,
          doctorName: demo.doctorName,
          visitDate: demo.visitDate,
        },
      ]);
      setPatientContext({
        patientName: demo.patientName,
        age: demo.age,
        sex: demo.sex,
        doctorName: demo.doctorName,
        clinicName: demo.clinicName,
        detectedConditions: demo.diagnosisNotes,
        activeComorbidities: demo.defaultComorbidities,
      });
      setMedications(decoded);
      setBlisterChecks([]);
      setOriginalImageUrl(renderedRx);
      setSauvolaImageUrl(sauvola);
      setActiveTab('scanner');
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Unable to process demo prescription.');
    } finally {
      setIsProcessingRx(false);
    }
  }, []);

  // Only load a sample automatically if ?demo=1 is explicitly requested
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      handleLoadDemoCase(DEMO_PRESCRIPTION_CASES[0]);
    }
  }, [handleLoadDemoCase]);

  const handleUploadPrescriptionImage = async (
    file: File,
    options?: {
      appendAsNewVisit?: boolean;
      clinicNameOverride?: string;
      visitDateOverride?: string;
    },
  ) => {
    stopBanglaSpeech();
    setSpeakingId(null);
    setRxError(null);
    setLastUploadedRxAction({ file, ...options });
    setIsProcessingRx(true);
    setJustSavedOffline(false);

    const isAppending = Boolean(options?.appendAsNewVisit && medications.length > 0);

    try {
      const dataUrl = await fileToDataUrl(file);
      const sauvola = await applySauvolaThreshold(dataUrl);
      if (!isAppending) {
        setOriginalImageUrl(dataUrl);
        setSauvolaImageUrl(sauvola);
      }

      const response = await fetch('/api/analyze-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const result = (await response.json()) as {
        error?: string;
        patientName?: string;
        age?: number;
        sex?: string;
        doctorName?: string;
        clinicName?: string;
        detectedConditions?: string[];
        medications?: Array<{
          ocrRaw: string;
          hypotheses: string[];
          dosageFormHint?: string;
          strengthHint?: string;
          scheduleShorthand: string;
          durationDays?: number;
          bbox?: number[];
        }>;
      };

      if (!response.ok) {
        setRxError(result.error || 'Vision extraction failed. Try another photo or a sample case.');
        return;
      }

      const visitNumber = isAppending ? visits.length + 1 : 1;
      const visitId = `visit-${Date.now()}`;
      const resolvedClinic =
        options?.clinicNameOverride?.trim() ||
        result.clinicName?.trim() ||
        `Clinic ${String.fromCharCode(64 + visitNumber)}`;
      const resolvedDate = options?.visitDateOverride?.trim() || formatTodayShort();
      const newRxId = `COU-RX-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 899))}`;

      const rawLines: RawVlmMedicationLine[] = (result.medications ?? []).map((m, idx) => ({
        lineId: `vlm-${visitId}-${idx}`,
        ocrRaw: m.ocrRaw,
        hypotheses: m.hypotheses?.length ? m.hypotheses : [m.ocrRaw],
        dosageFormHint: m.dosageFormHint,
        strengthHint: m.strengthHint,
        scheduleShorthand: m.scheduleShorthand || '1+0+1 p/c 7d',
        durationDays: m.durationDays,
        bbox:
          Array.isArray(m.bbox) && m.bbox.length === 4
            ? [m.bbox[0], m.bbox[1], m.bbox[2], m.bbox[3]]
            : undefined,
      }));

      if (rawLines.length === 0) {
        setRxError(
          'No medication lines could be detected in this photo. Ensure good lighting and retry, or add lines manually.',
        );
        return;
      }

      const notes = result.detectedConditions ?? [];
      const inferredComorbidities = detectComorbiditiesFromNotes(notes);
      if (
        typeof result.age === 'number' &&
        result.age < 12 &&
        !inferredComorbidities.includes('PEDIATRIC')
      ) {
        inferredComorbidities.push('PEDIATRIC');
      }

      const decoded = await decodeRawLinesWithCrops(rawLines, dataUrl, {
        visitId,
        visitLabel: resolvedClinic,
        visitDate: resolvedDate,
      });

      const newVisit: PrescriptionVisit = {
        visitId,
        prescriptionId: newRxId,
        clinicName: resolvedClinic,
        doctorName: result.doctorName,
        visitDate: resolvedDate,
      };

      if (isAppending) {
        setVisits((prev) => [...prev, newVisit]);
        setMedications((prev) => [...prev, ...decoded]);
        setPatientContext((prev) => ({
          ...prev,
          detectedConditions: Array.from(new Set([...prev.detectedConditions, ...notes])),
          activeComorbidities: Array.from(
            new Set([...prev.activeComorbidities, ...inferredComorbidities]),
          ),
        }));
      } else {
        setPrescriptionId(newRxId);
        setVisits([newVisit]);
        setPatientContext({
          patientName: result.patientName,
          age: result.age,
          sex: result.sex,
          doctorName: result.doctorName,
          clinicName: resolvedClinic,
          detectedConditions: notes,
          activeComorbidities: inferredComorbidities,
        });
        setMedications(decoded);
        setBlisterChecks([]);
      }
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Failed to analyze prescription image.');
    } finally {
      setIsProcessingRx(false);
    }
  };

  /**
   * Challenge 1: Appends a follow-up Clinic B demo prescription to run a unified cross-visit audit.
   */
  const handleAddFollowupDemoVisit = async (
    demo: DemoPrescriptionCase,
    clinicNameOverride?: string,
    visitDateOverride?: string,
  ) => {
    setRxError(null);
    const visitId = `visit-${demo.id}-${Date.now()}`;
    const clinicName = clinicNameOverride?.trim() || demo.clinicName;
    const visitDate = visitDateOverride?.trim() || demo.visitDate;

    const linesWithUniqueIds: RawVlmMedicationLine[] = demo.rawLines.map((line, idx) => ({
      ...line,
      lineId: `${visitId}-${idx}`,
    }));

    const decoded = await decodeRawLinesWithCrops(linesWithUniqueIds, undefined, {
      visitId,
      visitLabel: clinicName,
      visitDate,
    });

    const newVisit: PrescriptionVisit = {
      visitId,
      prescriptionId: demo.prescriptionId,
      clinicName,
      doctorName: demo.doctorName,
      visitDate,
    };

    setVisits((prev) => {
      if (prev.length === 0 && medications.length > 0) {
        const initialVisit: PrescriptionVisit = {
          visitId: 'visit-initial',
          prescriptionId: prescriptionId || 'COU-RX-1',
          clinicName: patientContext.clinicName || 'Clinic A',
          doctorName: patientContext.doctorName,
          visitDate: formatTodayShort(),
        };
        return [initialVisit, newVisit];
      }
      return [...prev, newVisit];
    });

    setMedications((prev) => {
      const normalizedPrev = prev.map((m) =>
        m.visitId
          ? m
          : {
              ...m,
              visitId: 'visit-initial',
              visitLabel: patientContext.clinicName || 'Clinic A',
              visitDate: formatTodayShort(),
            },
      );
      return [...normalizedPrev, ...decoded];
    });

    setPatientContext((prev) => ({
      ...prev,
      detectedConditions: Array.from(new Set([...prev.detectedConditions, ...demo.diagnosisNotes])),
      activeComorbidities: Array.from(
        new Set([...prev.activeComorbidities, ...demo.defaultComorbidities]),
      ),
    }));
  };

  /**
   * Challenge 1: Merges a previously saved offline visit from IndexedDB into the current cross-visit audit.
   */
  const handleImportSavedVisit = (scan: SavedScanRecord) => {
    setRxError(null);
    const visitId = `saved-${scan.prescriptionId}-${Date.now()}`;
    const clinicName = scan.patientContext.clinicName || `Saved Visit (${scan.prescriptionId})`;
    const visitDate = new Date(scan.savedAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const importedMeds: DecodedMedication[] = scan.medications.map((m, idx) => ({
      ...m,
      lineId: `${visitId}-${idx}`,
      visitId,
      visitLabel: m.visitLabel || clinicName,
      visitDate: m.visitDate || visitDate,
    }));

    const newVisit: PrescriptionVisit = {
      visitId,
      prescriptionId: scan.prescriptionId,
      clinicName,
      doctorName: scan.patientContext.doctorName,
      visitDate,
    };

    setVisits((prev) => [...prev, newVisit]);
    setMedications((prev) => [...prev, ...importedMeds]);
    setPatientContext((prev) => ({
      ...prev,
      detectedConditions: Array.from(
        new Set([...prev.detectedConditions, ...scan.patientContext.detectedConditions]),
      ),
      activeComorbidities: Array.from(
        new Set([...prev.activeComorbidities, ...scan.patientContext.activeComorbidities]),
      ),
    }));
  };

  const handleRemoveVisit = (visitId: string) => {
    setVisits((prev) => prev.filter((v) => v.visitId !== visitId));
    setMedications((prev) => prev.filter((m) => m.visitId !== visitId));
  };

  const handleToggleComorbidity = (id: ComorbidityId) => {
    setPatientContext((prev) => {
      const exists = prev.activeComorbidities.includes(id);
      return {
        ...prev,
        activeComorbidities: exists
          ? prev.activeComorbidities.filter((c) => c !== id)
          : [...prev.activeComorbidities, id],
      };
    });
  };

  const handleAddDetectedComorbiditiesFromVoice = (transcript: string) => {
    const detected = detectComorbiditiesFromNotes([transcript]);
    setPatientContext((prev) => ({
      ...prev,
      detectedConditions: Array.from(new Set([...prev.detectedConditions, transcript])),
      activeComorbidities: Array.from(new Set([...prev.activeComorbidities, ...detected])),
    }));
  };

  const handleConfirmAmbiguousCandidate = (lineId: string, chosenDrug: DgdaDrugRecord) => {
    setMedications((prev) =>
      prev.map((med) => {
        if (med.lineId !== lineId) return med;
        const compiled = compileBanglaSchedule(
          chosenDrug,
          med.scheduleShorthand,
          med.compiledSchedule.durationDays,
        );
        const matchedCand = med.topCandidates.find((c) => c.drug.id === chosenDrug.id);
        return {
          ...med,
          resolvedDrug: chosenDrug,
          groundingScore: matchedCand?.breakdown.totalScore ?? med.groundingScore,
          scoreBreakdown: matchedCand?.breakdown ?? med.scoreBreakdown,
          requiresHumanVerification: false,
          humanConfirmed: true,
          compiledSchedule: compiled,
        };
      }),
    );
  };

  const handleAddManualRxLine = async (
    ocrRaw: string,
    shorthand: string,
    visitIdOverride?: string,
  ) => {
    const activeVisit =
      visits.find((v) => v.visitId === visitIdOverride) ?? visits[visits.length - 1];
    const newLine: RawVlmMedicationLine = {
      lineId: `manual-${Date.now()}`,
      ocrRaw,
      hypotheses: [ocrRaw],
      scheduleShorthand: shorthand,
    };
    const decoded = await decodeRawLinesWithCrops(
      [newLine],
      undefined,
      activeVisit
        ? {
            visitId: activeVisit.visitId,
            visitLabel: activeVisit.clinicName,
            visitDate: activeVisit.visitDate,
          }
        : undefined,
    );
    if (!prescriptionId) {
      setPrescriptionId(`COU-RX-${new Date().getFullYear()}-MAN`);
    }
    setMedications((prev) => [...prev, ...decoded]);
  };

  const handleRemoveMedication = (lineId: string) => {
    setMedications((prev) => prev.filter((m) => m.lineId !== lineId));
  };

  const handleRunDemoBlister = async (fixture: DemoBlisterFixture) => {
    setBlisterError(null);
    setIsVerifyingBlister(true);
    try {
      const stripDataUrl = renderDemoBlisterCanvas(fixture);
      const claheDataUrl = await applyClaheFoilFilter(stripDataUrl);
      const result = verifyBlisterAgainstPrescription(fixture.ocrStripRaw, medications, {
        stripId: `${fixture.id}-${Date.now()}`,
        dosageFormHint: fixture.dosageFormHint,
        strengthHint: fixture.strengthHint,
        stripImageDataUrl: stripDataUrl,
        claheImageDataUrl: claheDataUrl,
        readability: fixture.readability,
        isCroppedOrDamaged: fixture.isCroppedOrDamaged,
        ocrConfidence: fixture.ocrConfidence,
        readabilityReason: fixture.readabilityReason,
      });
      setBlisterChecks((prev) => [result, ...prev]);
    } catch (err) {
      setBlisterError(err instanceof Error ? err.message : 'Failed to verify blister strip.');
    } finally {
      setIsVerifyingBlister(false);
    }
  };

  const handleUploadBlisterImage = async (file: File) => {
    setBlisterError(null);
    setLastUploadedBlisterFile(file);
    setIsVerifyingBlister(true);
    try {
      const stripDataUrl = await fileToDataUrl(file);
      const claheDataUrl = await applyClaheFoilFilter(stripDataUrl);

      const response = await fetch('/api/analyze-blister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: claheDataUrl }),
      });
      const data = (await response.json()) as {
        error?: string;
        ocrStripRaw?: string;
        brandGuess?: string;
        dosageFormHint?: string;
        strengthHint?: string;
        readability?: BlisterReadability;
        isCroppedOrDamaged?: boolean;
        ocrConfidence?: number;
        readabilityReason?: string;
      };

      if (!response.ok) {
        setBlisterError(data.error || 'Blister foil OCR failed.');
        return;
      }

      const rawText =
        data.readability === 'UNREADABLE'
          ? data.ocrStripRaw || ''
          : data.brandGuess
            ? `${data.brandGuess} ${data.strengthHint || ''}`.trim()
            : data.ocrStripRaw || '';

      const result = verifyBlisterAgainstPrescription(rawText, medications, {
        stripId: `upload-${Date.now()}`,
        dosageFormHint: data.dosageFormHint,
        strengthHint: data.strengthHint,
        stripImageDataUrl: stripDataUrl,
        claheImageDataUrl: claheDataUrl,
        readability: data.readability,
        isCroppedOrDamaged: data.isCroppedOrDamaged,
        ocrConfidence: data.ocrConfidence,
        readabilityReason: data.readabilityReason,
      });
      setBlisterChecks((prev) => [result, ...prev]);
    } catch (err) {
      setBlisterError(err instanceof Error ? err.message : 'Unable to analyze blister strip photo.');
    } finally {
      setIsVerifyingBlister(false);
    }
  };

  const handleRunManualFoilText = (foilImprint: string) => {
    setBlisterError(null);
    const result = verifyBlisterAgainstPrescription(foilImprint, medications, {
      stripId: `manual-strip-${Date.now()}`,
    });
    setBlisterChecks((prev) => [result, ...prev]);
  };

  const handleSpeakText = async (id: string, text: string, urgent = false) => {
    setSpeakingId(id);
    await speakBanglaText(text, {
      urgent,
      onEnd: () => {
        setSpeakingId((curr) => (curr === id ? null : curr));
      },
    });
  };

  const handleStopSpeech = () => {
    stopBanglaSpeech();
    setSpeakingId(null);
  };

  const handleSaveOffline = async () => {
    if (!prescriptionId || medications.length === 0) return;
    const record: SavedScanRecord = {
      prescriptionId,
      savedAt: new Date().toISOString(),
      patientContext,
      visits,
      medications,
      blisterChecks,
      prescriptionImageDataUrl: originalImageUrl ?? undefined,
    };
    await saveScanOffline(record);
    const updated = await loadSavedScansOffline();
    setSavedScans(updated);
    setJustSavedOffline(true);
    setTimeout(() => setJustSavedOffline(false), 2200);
  };

  const handleLoadSavedScan = async (scan: SavedScanRecord) => {
    setPrescriptionId(scan.prescriptionId);
    setPatientContext(scan.patientContext);
    setVisits(
      scan.visits && scan.visits.length > 0
        ? scan.visits
        : [
            {
              visitId: `visit-${scan.prescriptionId}`,
              prescriptionId: scan.prescriptionId,
              clinicName: scan.patientContext.clinicName || 'Saved Clinic',
              doctorName: scan.patientContext.doctorName,
              visitDate: new Date(scan.savedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
            },
          ],
    );
    setMedications(scan.medications);
    setBlisterChecks(scan.blisterChecks);
    setOriginalImageUrl(scan.prescriptionImageDataUrl ?? null);
    if (scan.prescriptionImageDataUrl) {
      const sauvola = await applySauvolaThreshold(scan.prescriptionImageDataUrl);
      setSauvolaImageUrl(sauvola);
    } else {
      setSauvolaImageUrl(null);
    }
    setActiveTab('scanner');
  };

  const handleDeleteSavedScan = async (id: string) => {
    await deleteSavedScanOffline(id);
    const updated = await loadSavedScansOffline();
    setSavedScans(updated);
  };

  const handleNewScan = () => {
    stopBanglaSpeech();
    setSpeakingId(null);
    setPrescriptionId('');
    setVisits([]);
    setPatientContext({ detectedConditions: [], activeComorbidities: [] });
    setMedications([]);
    setBlisterChecks([]);
    setOriginalImageUrl(null);
    setSauvolaImageUrl(null);
    setRxError(null);
    setBlisterError(null);
    setLastUploadedRxAction(null);
    setLastUploadedBlisterFile(null);
    setActiveTab('scanner');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFB] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewScan={handleNewScan}
        hasActivePrescription={medications.length > 0}
        lang={lang}
        onChangeLang={setLang}
      />

      {/* Main Centered Minimalist Viewport */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeTab === 'scanner' && (
          <ScannerWorkspace
            lang={lang}
            onChangeLang={setLang}
            prescriptionId={prescriptionId}
            visits={visits}
            savedScans={savedScans}
            patientContext={patientContext}
            medications={medications}
            clinicalAlerts={clinicalAlerts}
            blisterChecks={blisterChecks}
            priceReport={priceReport}
            pipelinePayload={pipelinePayload}
            originalImageUrl={originalImageUrl}
            sauvolaImageUrl={sauvolaImageUrl}
            isProcessing={isProcessingRx}
            errorMessage={rxError}
            canRetryUpload={lastUploadedRxAction !== null}
            onRetryUpload={() => {
              if (lastUploadedRxAction) {
                handleUploadPrescriptionImage(lastUploadedRxAction.file, {
                  appendAsNewVisit: lastUploadedRxAction.appendAsNewVisit,
                  clinicNameOverride: lastUploadedRxAction.clinicNameOverride,
                  visitDateOverride: lastUploadedRxAction.visitDateOverride,
                });
              }
            }}
            speakingId={speakingId}
            justSavedOffline={justSavedOffline}
            onUploadPrescriptionImage={(file) => handleUploadPrescriptionImage(file)}
            onUploadAdditionalVisitImage={(file, clinicName, visitDate) =>
              handleUploadPrescriptionImage(file, {
                appendAsNewVisit: true,
                clinicNameOverride: clinicName,
                visitDateOverride: visitDate,
              })
            }
            onOpenCamera={() => setCameraMode('rx')}
            onOpenVisitCamera={(clinicName, visitDate) => {
              setPendingVisitMeta({ clinicName, visitDate });
              setCameraMode('rx-visit');
            }}
            onLoadDemoCase={handleLoadDemoCase}
            onAddFollowupDemoVisit={handleAddFollowupDemoVisit}
            onImportSavedVisit={handleImportSavedVisit}
            onRemoveVisit={handleRemoveVisit}
            onToggleComorbidity={handleToggleComorbidity}
            onAddDetectedComorbiditiesFromVoice={handleAddDetectedComorbiditiesFromVoice}
            onConfirmAmbiguousCandidate={handleConfirmAmbiguousCandidate}
            onAddManualRxLine={handleAddManualRxLine}
            onRemoveMedication={handleRemoveMedication}
            onSaveOffline={handleSaveOffline}
            onSpeakText={handleSpeakText}
            onStopSpeech={handleStopSpeech}
            onProceedToBlister={() => setActiveTab('blister')}
            onProceedToCard={() => setActiveTab('caregiver')}
          />
        )}

        {activeTab === 'blister' && (
          <BlisterVerifier
            lang={lang}
            medications={medications}
            blisterChecks={blisterChecks}
            isVerifying={isVerifyingBlister}
            errorMessage={blisterError}
            canRetryUpload={lastUploadedBlisterFile !== null}
            onRetryUpload={() => {
              if (lastUploadedBlisterFile) handleUploadBlisterImage(lastUploadedBlisterFile);
            }}
            speakingId={speakingId}
            onUploadBlisterImage={handleUploadBlisterImage}
            onOpenCamera={() => setCameraMode('blister')}
            onRunDemoBlister={handleRunDemoBlister}
            onRunManualFoilText={handleRunManualFoilText}
            onClearBlisterChecks={() => setBlisterChecks([])}
            onSpeakText={handleSpeakText}
            onStopSpeech={handleStopSpeech}
            onGoToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'caregiver' && (
          <CaregiverCardView
            lang={lang}
            prescriptionId={prescriptionId}
            patientContext={patientContext}
            medications={medications}
            priceReport={priceReport}
            speakingId={speakingId}
            onSpeakText={handleSpeakText}
            onStopSpeech={handleStopSpeech}
            onGoToScanner={() => setActiveTab('scanner')}
          />
        )}

        {activeTab === 'dgda' && (
          <DgdaIndexView
            lang={lang}
            savedScans={savedScans}
            onLoadSavedScan={handleLoadSavedScan}
            onDeleteSavedScan={handleDeleteSavedScan}
          />
        )}
      </main>

      {/* Live Camera Capture Modal (Rx, Follow-Up Clinic Visit, & Blister Strip) */}
      <CameraCaptureModal
        isOpen={cameraMode !== null}
        title={
          cameraMode === 'blister'
            ? lang === 'bn'
              ? 'ওষুধের পাতার ছবি তুলুন'
              : 'Take Photo of Medicine Strip'
            : cameraMode === 'rx-visit'
              ? lang === 'bn'
                ? 'অন্য ক্লিনিকের প্রেসক্রিপশন তুলুন'
                : 'Take Photo of Another Clinic’s Prescription'
              : lang === 'bn'
                ? 'প্রেসক্রিপশনের ছবি তুলুন'
                : 'Take Photo of Prescription'
        }
        subtitle={
          cameraMode === 'blister'
            ? 'Hold the back of the medicine strip steady inside the frame.'
            : 'Keep the doctor’s prescription flat inside the frame with clear lighting.'
        }
        onCaptureFile={(file) => {
          if (cameraMode === 'blister') {
            handleUploadBlisterImage(file);
          } else if (cameraMode === 'rx-visit') {
            handleUploadPrescriptionImage(file, {
              appendAsNewVisit: true,
              clinicNameOverride: pendingVisitMeta?.clinicName,
              visitDateOverride: pendingVisitMeta?.visitDate,
            });
            setPendingVisitMeta(null);
          } else {
            handleUploadPrescriptionImage(file);
          }
        }}
        onClose={() => {
          setCameraMode(null);
          setPendingVisitMeta(null);
        }}
      />

      {/* Quiet Footer */}
      <footer className="no-print border-t border-slate-200/60 mt-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>OshudhGuard</span>
          <span>Always confirm medicine changes with your doctor or pharmacist.</span>
        </div>
      </footer>
    </div>
  );
}
