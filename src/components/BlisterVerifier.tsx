import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RefreshCw,
  ScanLine,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { DEMO_BLISTER_FIXTURES, type DemoBlisterFixture } from '../data/demoCases';
import { getPlainBlisterMessage, getPlainBlisterTitle } from '../utils/plainLanguage';
import type { BlisterVerificationResult, DecodedMedication } from '../types/clinical';

interface BlisterVerifierProps {
  lang: 'en' | 'bn';
  medications: DecodedMedication[];
  blisterChecks: BlisterVerificationResult[];
  isVerifying: boolean;
  errorMessage: string | null;
  canRetryUpload?: boolean;
  onRetryUpload?: () => void;
  speakingId: string | null;
  onUploadBlisterImage: (file: File) => void;
  onOpenCamera: () => void;
  onRunDemoBlister: (fixture: DemoBlisterFixture) => void;
  onRunManualFoilText: (foilImprint: string) => void;
  onClearBlisterChecks: () => void;
  onSpeakText: (id: string, text: string, urgent?: boolean) => void;
  onStopSpeech: () => void;
  onGoToScanner: () => void;
}

const SIMPLE_STRIP_LABELS: Array<{ en: string; bn: string }> = [
  { en: 'Sergel 40mg (Wrong dose)', bn: 'সার্জেল ৪০ (ভুল মাত্রা)' },
  { en: 'Scissor-cut foil (Unreadable)', bn: 'কাটা ও ঝাপসা পাতা (পড়া যাচ্ছে না)' },
  { en: 'Sergel 20mg (Exact match)', bn: 'সার্জেল ২০ (সঠিক)' },
  { en: 'Exium 20mg (Same medicine)', bn: 'এক্সিয়াম ২০ (একই ওষুধ)' },
  { en: 'Amdocal 5mg (Wrong medicine)', bn: 'অ্যামডোক্যাল ৫ (ভুল ওষুধ)' },
];

export const BlisterVerifier: React.FC<BlisterVerifierProps> = ({
  lang,
  medications,
  blisterChecks,
  isVerifying,
  errorMessage,
  canRetryUpload,
  onRetryUpload,
  speakingId,
  onUploadBlisterImage,
  onOpenCamera,
  onRunDemoBlister,
  onRunManualFoilText,
  onClearBlisterChecks,
  onSpeakText,
  onStopSpeech,
  onGoToScanner,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showClaheView, setShowClaheView] = useState(false);
  const [manualFoilInput, setManualFoilInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const latestCheck = blisterChecks[0] ?? null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadBlisterImage(file);
    e.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFoilInput.trim()) {
      setManualError('Type the name printed on the back of the strip (e.g. Sergel 40mg).');
      return;
    }
    setManualError(null);
    onRunManualFoilText(manualFoilInput.trim());
    setManualFoilInput('');
  };

  if (medications.length === 0) {
    return (
      <section className="py-12 sm:py-20 text-center space-y-5">
        <ScanLine className="w-8 h-8 text-teal-700 mx-auto" aria-hidden="true" />
        <div className="space-y-1.5 max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">
            {lang === 'bn' ? 'আগে প্রেসক্রিপশন স্ক্যান করুন' : 'Scan a Prescription First'}
          </h1>
          <p className="text-sm text-slate-500">
            Once your prescription is loaded, you can check each medicine strip from the pharmacy
            against it.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToScanner}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors cursor-pointer"
        >
          Go to Prescription
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-9">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload medicine strip photo"
      />

      {/* Clean Header */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {lang === 'bn' ? 'ওষুধের পাতা যাচাই' : 'Check Your Medicine Strip'}
            </h1>
            <p className="text-sm text-slate-500 max-w-lg">
              {lang === 'bn'
                ? 'ফার্মেসির দেওয়া ওষুধের পাতার ছবি দিন — প্রেসক্রিপশনের সাথে মিলছে কিনা সাথে সাথে জানুন।'
                : 'Take a photo of the medicine strip from the pharmacy to make sure the name and dose match your prescription.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              {lang === 'bn' ? 'ছবি আপলোড' : 'Upload Photo'}
            </button>
            <button
              type="button"
              onClick={onOpenCamera}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              {lang === 'bn' ? 'ক্যামেরা' : 'Camera'}
            </button>
          </div>
        </div>

        {/* Quiet Sample Strips + Type Manually Link */}
        <div className="pt-3 border-t border-slate-200/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">
              {lang === 'bn' ? 'নমুনা পাতা পরীক্ষা করুন:' : 'Try a sample strip:'}
            </span>
            <button
              type="button"
              onClick={() => setShowManualInput((v) => !v)}
              className="text-teal-800 hover:text-teal-950 font-medium underline underline-offset-4 cursor-pointer"
            >
              {showManualInput
                ? lang === 'bn'
                  ? 'বন্ধ করুন'
                  : 'Hide typing'
                : lang === 'bn'
                  ? 'নাম লিখে যাচাই করুন'
                  : 'Or type strip name'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_BLISTER_FIXTURES.map((fixture, idx) => (
              <button
                key={fixture.id}
                type="button"
                disabled={isVerifying}
                onClick={() => onRunDemoBlister(fixture)}
                className="text-left px-4 py-3 rounded-xl border border-slate-200/90 bg-white hover:border-teal-600 transition-colors cursor-pointer text-xs font-medium text-slate-800"
              >
                {lang === 'bn' ? SIMPLE_STRIP_LABELS[idx].bn : SIMPLE_STRIP_LABELS[idx].en}
              </button>
            ))}
          </div>
        </div>

        {showManualInput && (
          <form
            onSubmit={handleManualSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                aria-label="Name printed on medicine strip"
                value={manualFoilInput}
                onChange={(e) => setManualFoilInput(e.target.value)}
                placeholder="Type what is printed on the strip (e.g. Sergel 40mg)"
                className="sm:col-span-9 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="sm:col-span-3 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Check
              </button>
            </div>
            {manualError && (
              <p className="text-xs text-red-700" role="alert">
                {manualError}
              </p>
            )}
          </form>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-200 bg-red-50 text-sm text-red-900"
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
      </section>

      {/* Loading */}
      {isVerifying && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse space-y-3">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      )}

      {/* Clean Verification Verdict */}
      {!isVerifying && latestCheck && (
        <section
          aria-label="Strip Check Result"
          className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${
            latestCheck.status === 'UNREADABLE_FOIL'
              ? 'border-slate-300 bg-slate-100/80'
              : latestCheck.status === 'CRITICAL_MISMATCH'
                ? 'border-red-200 bg-red-50/60'
                : latestCheck.status === 'BIO_EQUIVALENT'
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-emerald-200 bg-emerald-50/60'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {latestCheck.status === 'UNREADABLE_FOIL' && (
                  <>
                    <HelpCircle className="w-5 h-5 text-slate-600 shrink-0" aria-hidden="true" />
                    <span className="text-slate-900">
                      {getPlainBlisterTitle(latestCheck.status, lang)}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 text-amber-900">
                      {lang === 'bn' ? 'লাল সতর্কতা বন্ধ রাখা হয়েছে' : 'Red alert held back'}
                    </span>
                  </>
                )}
                {latestCheck.status === 'CRITICAL_MISMATCH' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                    <span className="text-red-800">
                      {getPlainBlisterTitle(latestCheck.status, lang)}
                    </span>
                  </>
                )}
                {latestCheck.status === 'BIO_EQUIVALENT' && (
                  <>
                    <RefreshCw className="w-5 h-5 text-amber-700" aria-hidden="true" />
                    <span className="text-amber-900">
                      {getPlainBlisterTitle(latestCheck.status, lang)}
                    </span>
                  </>
                )}
                {latestCheck.status === 'EXACT_MATCH' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" aria-hidden="true" />
                    <span className="text-emerald-900">
                      {getPlainBlisterTitle(latestCheck.status, lang)}
                    </span>
                  </>
                )}
              </div>

              <p
                className={`text-sm sm:text-base text-slate-800 leading-relaxed ${
                  lang === 'bn' ? 'font-bangla font-medium' : ''
                }`}
              >
                {getPlainBlisterMessage(latestCheck, lang)}
              </p>

              {latestCheck.status === 'UNREADABLE_FOIL' && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    {lang === 'bn' ? 'আবার ছবি তুলুন' : 'Retake Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    {lang === 'bn' ? 'অন্য ছবি দিন' : 'Upload Clearer Photo'}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                speakingId === latestCheck.stripId
                  ? onStopSpeech()
                  : onSpeakText(
                      latestCheck.stripId,
                      latestCheck.alertBangla,
                      latestCheck.status === 'CRITICAL_MISMATCH',
                    )
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                latestCheck.status === 'CRITICAL_MISMATCH'
                  ? 'bg-red-700 hover:bg-red-800 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {speakingId === latestCheck.stripId ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  {lang === 'bn' ? 'বাংলায় শুনুন' : 'Listen in Bangla'}
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-white/90 border border-slate-200/80 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-400">
                {lang === 'bn' ? 'প্রেসক্রিপশনে লেখা' : 'On prescription'}
              </div>
              <div className="font-semibold text-slate-900 mt-0.5">{latestCheck.prescribedItem}</div>
            </div>
            <div className="bg-white/90 border border-slate-200/80 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-400">
                {lang === 'bn' ? 'ওষুধের পাতায় পাওয়া গেছে' : 'On this strip'}
              </div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {latestCheck.status === 'UNREADABLE_FOIL'
                  ? lang === 'bn'
                    ? 'লেখা অস্পষ্ট বা কাটা'
                    : 'Unreadable / cut foil imprint'
                  : latestCheck.dispensedOnStrip}
              </div>
            </div>
          </div>

          {/* Clean Progressive Disclosure for Anti-Glare Scan Images */}
          {latestCheck.stripImageDataUrl && (
            <div className="pt-1 space-y-3">
              <button
                type="button"
                aria-expanded={showClaheView}
                onClick={() => setShowClaheView((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span>{showClaheView ? 'Hide strip scan view' : 'View strip scan & anti-glare filter'}</span>
                {showClaheView ? (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>

              {showClaheView && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs text-slate-500">Original strip photo</div>
                    <img
                      src={latestCheck.stripImageDataUrl}
                      alt="Original photograph of loose metallic blister strip"
                      referrerPolicy="no-referrer"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs text-teal-800">Anti-glare enhanced (CLAHE)</div>
                    <img
                      src={latestCheck.claheImageDataUrl || latestCheck.stripImageDataUrl}
                      alt="Anti-glare processed blister foil strip"
                      referrerPolicy="no-referrer"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Checked Strips History */}
      {blisterChecks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {lang === 'bn' ? 'যাচাইকৃত পাতা' : 'Checked strips'} ({blisterChecks.length})
            </h2>
            <button
              type="button"
              onClick={onClearBlisterChecks}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl divide-y divide-slate-100">
            {blisterChecks.map((check) => (
              <div
                key={check.stripId}
                className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-900">{check.dispensedOnStrip}</span>
                  <span className="text-slate-400 text-xs ml-2">vs {check.prescribedItem}</span>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    check.status === 'EXACT_MATCH'
                      ? 'text-emerald-700'
                      : check.status === 'BIO_EQUIVALENT'
                        ? 'text-amber-700'
                        : check.status === 'UNREADABLE_FOIL'
                          ? 'text-slate-600'
                          : 'text-red-700'
                  }`}
                >
                  {check.status === 'EXACT_MATCH'
                    ? 'Match'
                    : check.status === 'BIO_EQUIVALENT'
                      ? 'Same medicine'
                      : check.status === 'UNREADABLE_FOIL'
                        ? 'Manual check'
                        : 'Wrong'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
