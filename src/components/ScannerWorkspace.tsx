import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  Mic,
  MicOff,
  Plus,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  DEMO_FOLLOWUP_CLINIC_VISITS,
  DEMO_PRESCRIPTION_CASES,
  type DemoPrescriptionCase,
} from '../data/demoCases';
import { formatDrugLabel } from '../data/dgdaDatabase';
import {
  getPlainAlertMessage,
  getPlainAlertTitle,
  getPlainScheduleLine,
  getSimpleConditionLabel,
} from '../utils/plainLanguage';
import { PipelineInspector } from './PipelineInspector';
import type {
  BlisterVerificationResult,
  ClinicalAlert,
  ComorbidityId,
  DecodedMedication,
  DgdaDrugRecord,
  PatientContext,
  PrescriptionPipelinePayload,
  PrescriptionVisit,
  PriceTransparencyReport,
  SavedScanRecord,
} from '../types/clinical';

interface ScannerWorkspaceProps {
  lang: 'en' | 'bn';
  onChangeLang: (lang: 'en' | 'bn') => void;
  prescriptionId: string;
  visits: PrescriptionVisit[];
  savedScans: SavedScanRecord[];
  patientContext: PatientContext;
  medications: DecodedMedication[];
  clinicalAlerts: ClinicalAlert[];
  blisterChecks: BlisterVerificationResult[];
  priceReport: PriceTransparencyReport;
  pipelinePayload: PrescriptionPipelinePayload;
  originalImageUrl: string | null;
  sauvolaImageUrl: string | null;
  isProcessing: boolean;
  errorMessage: string | null;
  canRetryUpload?: boolean;
  onRetryUpload?: () => void;
  speakingId: string | null;
  justSavedOffline: boolean;
  onUploadPrescriptionImage: (file: File) => void;
  onUploadAdditionalVisitImage: (file: File, clinicName?: string, visitDate?: string) => void;
  onOpenCamera: () => void;
  onOpenVisitCamera: (clinicName?: string, visitDate?: string) => void;
  onLoadDemoCase: (demo: DemoPrescriptionCase) => void;
  onAddFollowupDemoVisit: (
    demo: DemoPrescriptionCase,
    clinicNameOverride?: string,
    visitDateOverride?: string,
  ) => void;
  onImportSavedVisit: (scan: SavedScanRecord) => void;
  onRemoveVisit: (visitId: string) => void;
  onToggleComorbidity: (id: ComorbidityId) => void;
  onAddDetectedComorbiditiesFromVoice: (transcript: string) => void;
  onConfirmAmbiguousCandidate: (lineId: string, chosenDrug: DgdaDrugRecord) => void;
  onAddManualRxLine: (ocrRaw: string, shorthand: string) => void;
  onRemoveMedication: (lineId: string) => void;
  onSaveOffline: () => void;
  onSpeakText: (id: string, text: string, urgent?: boolean) => void;
  onStopSpeech: () => void;
  onProceedToBlister: () => void;
  onProceedToCard: () => void;
}

const ALL_COMORBIDITIES: ComorbidityId[] = [
  'CKD',
  'PREGNANCY',
  'DIABETES',
  'HYPERTENSION',
  'PEDIATRIC',
  'HEPATIC',
  'ASTHMA',
  'GASTRIC_ULCER',
];

const SAMPLE_SHORT_LABELS: Array<{ en: string; bn: string }> = [
  { en: 'Kidney', bn: 'কিডনি' },
  { en: 'Heart', bn: 'হৃদরোগ' },
  { en: 'Pregnancy', bn: 'গর্ভাবস্থা' },
];

export const ScannerWorkspace: React.FC<ScannerWorkspaceProps> = ({
  lang,
  onChangeLang,
  prescriptionId,
  visits,
  savedScans,
  patientContext,
  medications,
  clinicalAlerts,
  blisterChecks,
  priceReport,
  pipelinePayload,
  originalImageUrl,
  sauvolaImageUrl,
  isProcessing,
  errorMessage,
  canRetryUpload,
  onRetryUpload,
  speakingId,
  justSavedOffline,
  onUploadPrescriptionImage,
  onUploadAdditionalVisitImage,
  onOpenCamera,
  onOpenVisitCamera,
  onLoadDemoCase,
  onAddFollowupDemoVisit,
  onImportSavedVisit,
  onRemoveVisit,
  onToggleComorbidity,
  onAddDetectedComorbiditiesFromVoice,
  onConfirmAmbiguousCandidate,
  onAddManualRxLine,
  onRemoveMedication,
  onSaveOffline,
  onSpeakText,
  onStopSpeech,
  onProceedToBlister,
  onProceedToCard,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const additionalVisitFileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showConditionsEditor, setShowConditionsEditor] = useState(false);
  const [showAddVisitPanel, setShowAddVisitPanel] = useState(false);
  const [newVisitClinicName, setNewVisitClinicName] = useState('');
  const [newVisitDate, setNewVisitDate] = useState('24 Nov 2026');
  const [showAddManual, setShowAddManual] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [showPipelineInspector, setShowPipelineInspector] = useState(false);
  const [rawCopied, setRawCopied] = useState(false);

  // Manual medicine form
  const [manualDrugInput, setManualDrugInput] = useState('');
  const [manualShorthandInput, setManualShorthandInput] = useState('1+0+1 p/c for 7 days');
  const [manualFormError, setManualFormError] = useState<string | null>(null);

  // Voice health note recorder
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceNoteStatus, setVoiceNoteStatus] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const ambiguousMeds = useMemo(
    () => medications.filter((m) => m.requiresHumanVerification && !m.humanConfirmed),
    [medications],
  );

  const importableSavedScans = useMemo(
    () => savedScans.filter((s) => !visits.some((v) => v.prescriptionId === s.prescriptionId)),
    [savedScans, visits],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadPrescriptionImage(file);
    e.target.value = '';
  };

  const handleAdditionalVisitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAdditionalVisitImage(
        file,
        newVisitClinicName.trim() || undefined,
        newVisitDate.trim() || undefined,
      );
      setShowAddVisitPanel(false);
      setNewVisitClinicName('');
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadPrescriptionImage(file);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDrugInput.trim()) {
      setManualFormError('Please type a medicine name (for example: Napa 500 or Sergel 20).');
      return;
    }
    setManualFormError(null);
    onAddManualRxLine(manualDrugInput.trim(), manualShorthandInput.trim() || '1+0+1 p/c 7d');
    setManualDrugInput('');
  };

  const handleCopyRawData = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pipelinePayload, null, 2));
      setRawCopied(true);
      setTimeout(() => setRawCopied(false), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleDownloadRawData = () => {
    const blob = new Blob([JSON.stringify(pipelinePayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prescriptionId || 'prescription'}-raw-data.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleVoiceComorbidityToggle = async () => {
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }

    setVoiceNoteStatus(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceNoteStatus('Microphone is not available here. Tap the health conditions below instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1];
          if (!base64) return;
          setVoiceNoteStatus('Listening complete — checking your note...');
          try {
            const resp = await fetch('/api/transcribe-comorbidities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
            });
            const data = (await resp.json()) as { transcript?: string; error?: string };
            if (resp.ok && data.transcript) {
              onAddDetectedComorbiditiesFromVoice(data.transcript);
              setVoiceNoteStatus(`Added: "${data.transcript}"`);
            } else {
              setVoiceNoteStatus(data.error || 'Could not understand the voice note.');
            }
          } catch {
            setVoiceNoteStatus('Voice note is unavailable offline. Select conditions below.');
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
      setVoiceNoteStatus('Listening... say any health issues (like kidney disease or diabetes), then tap stop.');
    } catch {
      setVoiceNoteStatus('Microphone permission was declined. Select conditions below.');
    }
  };

  return (
    <div className="space-y-9">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload prescription photo"
      />
      <input
        ref={additionalVisitFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAdditionalVisitFileChange}
        className="hidden"
        aria-label="Upload another clinic prescription photo"
      />

      {/* ULTRA-MINIMALIST LANDING SCREEN (Default on Open — Nothing Auto-Loaded) */}
      {!isProcessing && medications.length === 0 && (
        <section className="min-h-[64vh] flex flex-col items-center justify-center text-center py-10 space-y-8">
          <div className="space-y-2.5 max-w-md">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {lang === 'bn' ? 'প্রেসক্রিপশন যাচাই করুন' : 'Check a Prescription'}
            </h1>
            <p className="text-sm sm:text-base text-slate-500">
              {lang === 'bn'
                ? 'ছবি আপলোড করুন বা ক্যামেরা দিয়ে তুলুন।'
                : 'Upload a photo or take one with your camera.'}
            </p>
          </div>

          {/* Minimalist Upload / Camera Surface */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full max-w-sm bg-white border rounded-2xl p-6 space-y-3 transition-colors ${
              isDragging ? 'border-teal-600 bg-teal-50/30' : 'border-slate-200/80'
            }`}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              {lang === 'bn' ? 'ছবি আপলোড করুন' : 'Upload Photo'}
            </button>

            <button
              type="button"
              onClick={onOpenCamera}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-teal-700" aria-hidden="true" />
              {lang === 'bn' ? 'ছবি তুলুন' : 'Take Photo'}
            </button>

            <p className="text-[11px] text-slate-400 pt-1">
              {lang === 'bn'
                ? 'অথবা প্রেসক্রিপশনের ছবি এখানে টেনে এনে ছাড়ুন'
                : 'Or drag and drop a prescription photo here'}
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="max-w-sm w-full flex items-start gap-2.5 p-3.5 rounded-xl border border-red-200 bg-red-50 text-left text-sm text-red-900"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-2 flex-1">
                <p>{errorMessage}</p>
                {canRetryUpload && onRetryUpload && (
                  <button
                    type="button"
                    onClick={onRetryUpload}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Whisper-Quiet Optional Sample Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>{lang === 'bn' ? 'নমুনা দেখুন:' : 'Try a sample:'}</span>
            {DEMO_PRESCRIPTION_CASES.map((demo, idx) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => onLoadDemoCase(demo)}
                className="text-slate-500 hover:text-teal-800 underline underline-offset-4 transition-colors cursor-pointer"
              >
                {lang === 'bn' ? SAMPLE_SHORT_LABELS[idx].bn : SAMPLE_SHORT_LABELS[idx].en}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PROCESSING STATE */}
      {isProcessing && (
        <div
          aria-live="polite"
          className="bg-white border border-slate-200/80 rounded-2xl p-8 space-y-4 animate-pulse"
        >
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
        </div>
      )}

      {/* ACTIVE CLEAN PRESCRIPTION RESULTS VIEW */}
      {!isProcessing && medications.length > 0 && (
        <>
          {/* 1. Calm Patient Header & Quiet Controls */}
          <section className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {patientContext.patientName ||
                    (lang === 'bn' ? 'আপনার প্রেসক্রিপশন' : 'Your Prescription')}
                  {patientContext.age ? (
                    <span className="text-slate-400 font-normal text-xl">
                      {' '}
                      · {patientContext.age}y
                    </span>
                  ) : null}
                </h1>
                {patientContext.clinicName && (
                  <p className="text-xs text-slate-400">{patientContext.clinicName}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onSaveOffline}
                  aria-label="Save prescription offline"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  {justSavedOffline ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                      {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                      {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                    </>
                  )}
                </button>

                <div
                  role="group"
                  aria-label="Language"
                  className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs"
                >
                  <button
                    type="button"
                    aria-pressed={lang === 'en'}
                    onClick={() => onChangeLang('en')}
                    className={`px-2 py-1 font-medium rounded-md cursor-pointer ${
                      lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    aria-pressed={lang === 'bn'}
                    onClick={() => onChangeLang('bn')}
                    className={`px-2 py-1 font-medium font-bangla rounded-md cursor-pointer ${
                      lang === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    বাংলা
                  </button>
                </div>
              </div>
            </div>

            {/* Quiet Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-3 border-t border-slate-200/70 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddVisitPanel((v) => !v)}
                  className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:text-teal-950 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  {lang === 'bn' ? 'আরেকটি ক্লিনিক যোগ করুন' : 'Add another clinic'}
                </button>
                <span aria-hidden="true" className="text-slate-300">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  {lang === 'bn' ? 'নতুন ছবি' : 'Replace photo'}
                </button>
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  {lang === 'bn' ? 'ক্যামেরা' : 'Camera'}
                </button>
                <span aria-hidden="true" className="text-slate-300">
                  |
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                  <span className="text-slate-400">
                    {lang === 'bn' ? 'স্বাস্থ্য:' : 'Health:'}
                  </span>
                  <span className="font-medium text-slate-800">
                    {patientContext.activeComorbidities.length === 0
                      ? lang === 'bn'
                        ? 'কোনোটি নয়'
                        : 'None'
                      : patientContext.activeComorbidities
                          .map((id) => getSimpleConditionLabel(id, lang))
                          .join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowConditionsEditor((v) => !v)}
                    className="text-teal-800 hover:text-teal-950 font-medium underline underline-offset-4 cursor-pointer ml-0.5"
                  >
                    {showConditionsEditor
                      ? lang === 'bn'
                        ? 'শেষ'
                        : 'Done'
                      : lang === 'bn'
                        ? 'পরিবর্তন'
                        : 'Edit'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 mr-1">
                  {lang === 'bn' ? 'নমুনা:' : 'Samples:'}
                </span>
                {DEMO_PRESCRIPTION_CASES.map((demo, idx) => {
                  const active = prescriptionId === demo.prescriptionId;
                  return (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => onLoadDemoCase(demo)}
                      className={`px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer ${
                        active
                          ? 'bg-teal-50 text-teal-900 font-semibold'
                          : 'text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      {lang === 'bn' ? SAMPLE_SHORT_LABELS[idx].bn : SAMPLE_SHORT_LABELS[idx].en}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Multi-Visit Strip (only visible when auditing 2+ clinic visits together) */}
            {visits.length > 1 && (
              <div
                aria-label="Active clinic visits"
                className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {lang === 'bn'
                      ? `একসাথে যাচাই হচ্ছে (${visits.length}টি ক্লিনিক ভিজিট)`
                      : `Auditing across ${visits.length} clinic visits`}
                  </span>
                  <span className="text-slate-400">
                    {lang === 'bn' ? 'সব ভিজিটের ওষুধ মিলিয়ে দেখা হচ্ছে' : 'Cross-visit safety check active'}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {visits.map((visit, idx) => {
                    const count = medications.filter((m) => m.visitId === visit.visitId).length;
                    return (
                      <div
                        key={visit.visitId}
                        className="py-1.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-slate-800">
                            {lang === 'bn' ? `ভিজিট ${idx + 1}` : `Visit ${idx + 1}`}
                          </span>
                          <span className="text-slate-300 mx-1.5">·</span>
                          <span className="text-slate-700">{visit.clinicName}</span>
                          <span className="text-slate-400 ml-1.5">({visit.visitDate})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400 tabular-nums">
                            {count} {lang === 'bn' ? 'ওষুধ' : count === 1 ? 'med' : 'meds'}
                          </span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => onRemoveVisit(visit.visitId)}
                              aria-label={`Remove ${visit.clinicName}`}
                              className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Minimalist Collapsible Add Another Clinic Visit Drawer */}
            {showAddVisitPanel && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {lang === 'bn'
                        ? 'অন্য ক্লিনিকের প্রেসক্রিপশন যোগ করুন'
                        : 'Add Prescription from Another Clinic'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'bn'
                        ? 'ভিন্ন ডাক্তারের প্রেসক্রিপশন যোগ করলে দুই ভিজিটে একই ওষুধ বা ঝুঁকিপূর্ণ মিশ্রণ ধরা পড়বে।'
                        : 'Check for duplicate medicines or unsafe combinations across visits from different doctors.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddVisitPanel(false)}
                    aria-label="Close add clinic panel"
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    aria-label="Clinic or doctor name"
                    value={newVisitClinicName}
                    onChange={(e) => setNewVisitClinicName(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'ক্লিনিকের নাম (যেমন: পপুলার অর্থো ক্লিনিক)'
                        : 'Clinic name (optional, e.g. Clinic B · Ortho)'
                    }
                    className="sm:col-span-8 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
                  />
                  <input
                    type="text"
                    aria-label="Visit date"
                    value={newVisitDate}
                    onChange={(e) => setNewVisitDate(e.target.value)}
                    placeholder="24 Nov 2026"
                    className="sm:col-span-4 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-700"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => additionalVisitFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    {lang === 'bn' ? '২য় প্রেসক্রিপশন আপলোড' : 'Upload Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddVisitPanel(false);
                      onOpenVisitCamera(
                        newVisitClinicName.trim() || undefined,
                        newVisitDate.trim() || undefined,
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    {lang === 'bn' ? 'ছবি তুলুন' : 'Take Photo'}
                  </button>
                </div>

                {/* Import Previously Saved Offline Visit */}
                {importableSavedScans.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-400">
                      {lang === 'bn'
                        ? 'আগে সংরক্ষিত প্রেসক্রিপশন থেকে যোগ করুন:'
                        : 'Or add a saved prior visit:'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {importableSavedScans.slice(0, 3).map((scan) => (
                        <button
                          key={scan.prescriptionId}
                          type="button"
                          onClick={() => {
                            onImportSavedVisit(scan);
                            setShowAddVisitPanel(false);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          {scan.patientContext.clinicName || scan.prescriptionId} ({scan.medications.length}{' '}
                          meds)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quiet Sample Clinic B Follow-Up Visits */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                  <span>{lang === 'bn' ? 'নমুনা ২য় ক্লিনিক:' : 'Try sample 2nd clinic:'}</span>
                  {DEMO_FOLLOWUP_CLINIC_VISITS.map((followup) => (
                    <button
                      key={followup.id}
                      type="button"
                      onClick={() => {
                        onAddFollowupDemoVisit(
                          followup,
                          newVisitClinicName.trim() || undefined,
                          newVisitDate.trim() || undefined,
                        );
                        setShowAddVisitPanel(false);
                        setNewVisitClinicName('');
                      }}
                      className="text-teal-800 hover:text-teal-950 font-medium underline underline-offset-4 cursor-pointer"
                    >
                      {lang === 'bn' ? followup.titleBn : followup.titleEn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable Health Conditions Editor */}
            {showConditionsEditor && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {lang === 'bn'
                      ? 'রোগীর শারীরিক অবস্থা বেছে নিন যাতে ঝুঁকিপূর্ণ ওষুধ ধরা পড়ে।'
                      : 'Select any health conditions so we can check if these medicines are safe.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleVoiceComorbidityToggle}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      isRecordingVoice
                        ? 'border-red-300 bg-red-50 text-red-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isRecordingVoice ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                        {lang === 'bn' ? 'মুখে বলুন' : 'Speak'}
                      </>
                    )}
                  </button>
                </div>

                {voiceNoteStatus && (
                  <p className="text-xs text-teal-800 bg-teal-50 rounded-lg px-3 py-2">
                    {voiceNoteStatus}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_COMORBIDITIES.map((cid) => {
                    const active = patientContext.activeComorbidities.includes(cid);
                    return (
                      <button
                        key={cid}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggleComorbidity(cid)}
                        className={`flex items-center justify-between gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-teal-700 bg-teal-50 text-teal-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{getSimpleConditionLabel(cid, lang)}</span>
                        {active && (
                          <Check className="w-3.5 h-3.5 shrink-0 text-teal-700" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>{errorMessage}</div>
                </div>
                {canRetryUpload && onRetryUpload && (
                  <button
                    type="button"
                    onClick={onRetryUpload}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-800 hover:bg-red-100/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 2. SAFETY WARNINGS */}
          <section aria-label="Safety Warnings" className="space-y-3">
            {clinicalAlerts.length === 0 ? (
              <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 text-sm text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'bn'
                    ? 'এই ওষুধগুলোতে কোনো বড় ঝুঁকি পাওয়া যায়নি।'
                    : 'No major safety warnings found for these medicines.'}
                </span>
              </div>
            ) : (
              clinicalAlerts.map((alert) => {
                const isHigh = alert.severity === 'HIGH';
                const isSpeakingThis = speakingId === alert.id;
                return (
                  <article
                    key={alert.id}
                    className={`p-4 sm:p-5 rounded-2xl border space-y-1.5 ${
                      isHigh
                        ? 'border-red-200/80 bg-red-50/50'
                        : 'border-amber-200/80 bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                        {isHigh ? (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                        )}
                        {alert.isCrossVisit && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-red-700 text-white">
                            {lang === 'bn' ? 'দুই ভিজিট' : 'Cross-Visit'}
                          </span>
                        )}
                        <span className={isHigh ? 'text-red-800' : 'text-amber-800'}>
                          {getPlainAlertTitle(alert, lang)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-900">{alert.drugInvolved}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          isSpeakingThis
                            ? onStopSpeech()
                            : onSpeakText(alert.id, alert.banglaReason, true)
                        }
                        aria-label={`Listen to warning about ${alert.drugInvolved}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {isSpeakingThis ? (
                          <>
                            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                            {lang === 'bn' ? 'থামুন' : 'Stop'}
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {lang === 'bn' ? 'শুনুন' : 'Listen'}
                          </>
                        )}
                      </button>
                    </div>

                    <p
                      className={`text-sm text-slate-800 leading-relaxed ${
                        lang === 'bn' ? 'font-bangla' : ''
                      }`}
                    >
                      {getPlainAlertMessage(alert, lang)}
                    </p>
                  </article>
                );
              })
            )}
          </section>

          {/* 3. CHECK UNCLEAR HANDWRITING */}
          {ambiguousMeds.length > 0 && (
            <section
              aria-label="Check Unclear Handwriting"
              className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4"
            >
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-amber-950">
                  {lang === 'bn' ? 'অস্পষ্ট হাতের লেখা নিশ্চিত করুন' : 'Check Unclear Handwriting'}
                </h2>
                <p className="text-xs text-amber-900/80">
                  {lang === 'bn'
                    ? 'ডাক্তারের এই লেখাটি একটু অস্পষ্ট — সঠিক ওষুধটি বেছে নিন।'
                    : 'One handwritten line is hard to read. Choose the medicine your doctor meant.'}
                </p>
              </div>

              {ambiguousMeds.map((med) => (
                <div
                  key={med.lineId}
                  className="bg-white border border-amber-200/70 rounded-xl p-4 space-y-4"
                >
                  {med.croppedInkDataUrl && (
                    <img
                      src={med.croppedInkDataUrl}
                      alt={`Cropped handwritten prescription ink for ${med.ocrRaw}`}
                      className="h-12 w-auto max-w-full rounded-lg border border-slate-100 bg-slate-50 object-contain"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {med.topCandidates.slice(0, 2).map((cand) => (
                      <button
                        key={cand.drug.id}
                        type="button"
                        onClick={() => onConfirmAmbiguousCandidate(med.lineId, cand.drug)}
                        className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-teal-700 hover:bg-teal-50/30 transition-colors cursor-pointer space-y-0.5"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {formatDrugLabel(cand.drug)}
                        </div>
                        <div className="text-xs text-slate-500">{cand.drug.manufacturer}</div>
                        <div className="pt-1 text-xs font-medium text-teal-800">
                          {lang === 'bn' ? 'এটি নিশ্চিত করুন →' : 'Choose this medicine →'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* 4. CLEAN MEDICINES LIST */}
          <section aria-label="Medicines" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {lang === 'bn' ? 'আপনার ওষুধ' : 'Medicines'} ({medications.length})
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {lang === 'bn' ? 'আনুমানিক মূল্য' : 'Est. total'} ৳
                {priceReport.totalStatutoryMrpBdt.toFixed(0)}
              </span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {medications.map((med) => {
                const isSpeaking = speakingId === med.lineId;
                const needsCheck = med.requiresHumanVerification && !med.humanConfirmed;
                return (
                  <div key={med.lineId} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-base font-semibold text-slate-900">
                          {med.resolvedDrug.brandName} {med.resolvedDrug.strengthText}
                        </span>
                        <span className="text-sm font-bangla text-slate-400">
                          {med.resolvedDrug.banglaName}
                        </span>
                        {needsCheck && (
                          <span className="text-xs font-medium text-amber-700">
                            · {lang === 'bn' ? 'নিশ্চিত করুন' : 'Needs check'}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-sm text-slate-600 leading-relaxed ${
                          lang === 'bn' ? 'font-bangla' : ''
                        }`}
                      >
                        {getPlainScheduleLine(med, lang)}
                      </p>

                      {visits.length > 1 && med.visitLabel && (
                        <p className="text-[11px] text-slate-400">
                          {med.visitLabel}
                          {med.visitDate ? ` · ${med.visitDate}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400">
                        ৳{med.resolvedDrug.unitMrpBdt.toFixed(0)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          isSpeaking
                            ? onStopSpeech()
                            : onSpeakText(med.lineId, med.compiledSchedule.banglaVoiceText)
                        }
                        aria-label={`Listen in Bangla for ${med.resolvedDrug.brandName}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50/80 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {isSpeaking ? (
                          <>
                            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                            {lang === 'bn' ? 'থামুন' : 'Stop'}
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {lang === 'bn' ? 'শুনুন' : 'Listen'}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveMedication(med.lineId)}
                        aria-label={`Remove ${med.resolvedDrug.brandName}`}
                        className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Quiet Add Medicine Row */}
              <div className="px-4 sm:px-5 py-3 bg-slate-50/40">
                {!showAddManual ? (
                  <button
                    type="button"
                    onClick={() => setShowAddManual(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    {lang === 'bn' ? 'আরেকটি ওষুধ যোগ করুন' : 'Add a medicine'}
                  </button>
                ) : (
                  <form onSubmit={handleManualSubmit} className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        aria-label="Medicine name"
                        value={manualDrugInput}
                        onChange={(e) => setManualDrugInput(e.target.value)}
                        placeholder="Medicine name (e.g. Napa 500, Seclo 20)"
                        className="sm:col-span-5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                      <input
                        type="text"
                        aria-label="Dosage timing"
                        value={manualShorthandInput}
                        onChange={(e) => setManualShorthandInput(e.target.value)}
                        placeholder="e.g. 1+0+1 p/c for 7 days"
                        className="sm:col-span-4 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
                      />
                      <div className="sm:col-span-3 flex items-center gap-1.5">
                        <button
                          type="submit"
                          className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddManual(false)}
                          className="px-2 py-2 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    {manualFormError && (
                      <p className="text-xs text-red-700" role="alert">
                        {manualFormError}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* 5. NEXT STEPS & ON-DEMAND RAW DATA / PIPELINE TOGGLES */}
          <section className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onProceedToBlister}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'ওষুধের পাতা মিলিয়ে দেখুন' : 'Check Medicine Strip'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onProceedToCard}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'দৈনিক সময়সূচী দেখুন' : 'View Daily Schedule'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <button
                type="button"
                aria-expanded={showRawData}
                onClick={() => setShowRawData((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showRawData ? 'Hide raw data' : 'Show raw data'}</span>
              </button>

              <button
                type="button"
                aria-expanded={showPipelineInspector}
                onClick={() => setShowPipelineInspector((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <span>{lang === 'bn' ? 'কারিগরি বিবরণ' : 'Technical details'}</span>
                {showPipelineInspector ? (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </section>

          {/* ON-DEMAND RAW DATA PANEL */}
          {showRawData && (
            <section
              aria-label="Raw Extracted Data"
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Raw Prescription Data</h3>
                  <p className="text-xs text-slate-500">
                    Exact OCR text, visual hypotheses, grounding scores, and structured JSON output.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyRawData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    {rawCopied ? 'Copied' : 'Copy JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRawData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Download
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2 px-3">Raw OCR</th>
                      <th className="py-2 px-3">Hypotheses</th>
                      <th className="py-2 px-3">Shorthand</th>
                      <th className="py-2 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {medications.map((m) => (
                      <tr key={m.lineId}>
                        <td className="py-2 px-3 text-slate-900">{m.ocrRaw}</td>
                        <td className="py-2 px-3 text-slate-500">{m.hypotheses.join(' · ')}</td>
                        <td className="py-2 px-3 text-slate-600">{m.scheduleShorthand}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-900">
                          {m.groundingScore.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
                {JSON.stringify(pipelinePayload, null, 2)}
              </pre>
            </section>
          )}

          {showPipelineInspector && (
            <PipelineInspector
              prescriptionId={prescriptionId}
              patientContext={patientContext}
              medications={medications}
              clinicalAlerts={clinicalAlerts}
              blisterChecks={blisterChecks}
              pipelinePayload={pipelinePayload}
              originalImageUrl={originalImageUrl}
              sauvolaImageUrl={sauvolaImageUrl}
              onGoToBlister={onProceedToBlister}
            />
          )}
        </>
      )}
    </div>
  );
};
