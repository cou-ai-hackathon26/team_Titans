import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Moon,
  Printer,
  Square,
  Sun,
  Sunrise,
  Volume2,
} from 'lucide-react';
import { buildWhatsAppCaregiverMessage, toBanglaDigits } from '../engine/banglaCompiler';
import { downloadCaregiverCardPng } from '../utils/cardExporter';
import type {
  DecodedMedication,
  PatientContext,
  PriceTransparencyReport,
} from '../types/clinical';

interface CaregiverCardViewProps {
  lang: 'en' | 'bn';
  prescriptionId: string;
  patientContext: PatientContext;
  medications: DecodedMedication[];
  priceReport: PriceTransparencyReport;
  speakingId: string | null;
  onSpeakText: (id: string, text: string, urgent?: boolean) => void;
  onStopSpeech: () => void;
  onGoToScanner: () => void;
}

export const CaregiverCardView: React.FC<CaregiverCardViewProps> = ({
  lang,
  prescriptionId,
  patientContext,
  medications,
  priceReport,
  speakingId,
  onSpeakText,
  onStopSpeech,
  onGoToScanner,
}) => {
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [pharmacyBillInput, setPharmacyBillInput] = useState('');

  const fullBanglaScript = useMemo(() => {
    return medications.map((m) => m.compiledSchedule.banglaVoiceText).join(' ');
  }, [medications]);

  const parsedQuotedBill = parseFloat(pharmacyBillInput);
  const overchargeAmount =
    Number.isFinite(parsedQuotedBill) && parsedQuotedBill > 0
      ? Number((parsedQuotedBill - priceReport.totalStatutoryMrpBdt).toFixed(2))
      : null;

  const handleCopyWhatsApp = async () => {
    const msg = buildWhatsAppCaregiverMessage(
      prescriptionId,
      patientContext.patientName,
      medications,
      priceReport.totalStatutoryMrpBdt,
    );
    try {
      await navigator.clipboard.writeText(msg);
      setWhatsappCopied(true);
      setTimeout(() => setWhatsappCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (medications.length === 0) {
    return (
      <section className="py-12 sm:py-20 text-center space-y-5">
        <Sunrise className="w-8 h-8 text-amber-600 mx-auto" aria-hidden="true" />
        <div className="space-y-1.5 max-w-sm mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">
            {lang === 'bn' ? 'কোনো সময়সূচী তৈরি হয়নি' : 'No Schedule Yet'}
          </h1>
          <p className="text-sm text-slate-500">
            Scan a prescription first to create a simple morning, noon, and night guide with
            official medicine prices.
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
    <div className="space-y-10">
      {/* Clean Header & Actions */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {lang === 'bn' ? 'দৈনিক ওষুধের সময়সূচী' : 'Daily Schedule'}
          </h1>
          <p className="text-sm text-slate-500">
            {lang === 'bn'
              ? 'সকাল, দুপুর ও রাতের সহজ তালিকা এবং সরকারি ওষুধের মূল্য।'
              : 'Simple morning, noon, and night guide with official prices.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              speakingId === 'full-schedule'
                ? onStopSpeech()
                : onSpeakText('full-schedule', fullBanglaScript)
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            {speakingId === 'full-schedule' ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                Stop
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                {lang === 'bn' ? 'পুরো তালিকা শুনুন' : 'Listen All'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              downloadCaregiverCardPng(
                prescriptionId,
                patientContext,
                medications,
                priceReport.totalStatutoryMrpBdt,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Save Image
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Print
          </button>

          <button
            type="button"
            onClick={handleCopyWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            {whatsappCopied ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                WhatsApp
              </>
            )}
          </button>
        </div>
      </div>

      {/* HIGH-CONTRAST SUN/MOON CAREGIVER CARD */}
      <section
        aria-label="Daily Medicine Schedule Card"
        className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden"
      >
        <div className="bg-teal-800 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base sm:text-lg font-bold font-bangla">
              ওষুধ খাওয়ার দৈনিক সময়সূচী
            </div>
            <div className="text-xs text-teal-100 mt-0.5">
              {patientContext.patientName || 'Patient'}
              {patientContext.age ? ` · ${patientContext.age}y` : ''}
            </div>
          </div>
          <div className="text-right font-mono tabular-nums">
            <div className="text-[11px] text-teal-100">Official Total</div>
            <div className="text-lg font-bold">৳{priceReport.totalStatutoryMrpBdt.toFixed(0)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="py-3.5 px-5 text-xs font-semibold text-slate-500">Medicine</th>
                <th className="py-3.5 px-3 text-center bg-amber-50/60 border-x border-slate-100 min-w-[84px]">
                  <div className="inline-flex flex-col items-center gap-0.5 text-amber-800">
                    <Sunrise className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-bold font-bangla">সকাল</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center bg-sky-50/60 border-r border-slate-100 min-w-[84px]">
                  <div className="inline-flex flex-col items-center gap-0.5 text-sky-800">
                    <Sun className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-bold font-bangla">দুপুর</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center bg-indigo-50/60 border-r border-slate-100 min-w-[84px]">
                  <div className="inline-flex flex-col items-center gap-0.5 text-indigo-900">
                    <Moon className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-bold font-bangla">রাত</span>
                  </div>
                </th>
                <th className="no-print py-3.5 px-4 text-right text-xs font-semibold text-slate-400">
                  Voice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medications.map((med) => {
                const s = med.compiledSchedule;
                const isSpeaking = speakingId === `card-${med.lineId}`;

                const renderDoseCell = (count: number, dotColorClass: string) => {
                  if (count <= 0) {
                    return <span className="text-slate-300 font-mono text-base">—</span>;
                  }
                  const dotCount = Math.min(4, Math.ceil(count));
                  return (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center justify-center gap-1" aria-hidden="true">
                        {Array.from({ length: dotCount }).map((_, idx) => (
                          <span key={idx} className={`w-3 h-3 rounded-full ${dotColorClass}`} />
                        ))}
                      </div>
                      <span className="text-xs font-bold font-bangla text-slate-900 tabular-nums">
                        {toBanglaDigits(count)} টি
                      </span>
                    </div>
                  );
                };

                return (
                  <tr key={med.lineId}>
                    <td className="py-4 px-5">
                      <div className="text-sm sm:text-base font-semibold text-slate-900">
                        {med.resolvedDrug.brandName} {med.resolvedDrug.strengthText}{' '}
                        <span className="font-bangla font-normal text-slate-500">
                          ({med.resolvedDrug.banglaName})
                        </span>
                      </div>
                      <div className="text-xs font-bangla text-slate-600 mt-1">
                        {s.banglaTimingLabel} · {toBanglaDigits(s.durationDays)} দিন
                      </div>
                    </td>

                    <td className="py-4 px-3 text-center bg-amber-50/20 border-x border-slate-100">
                      {renderDoseCell(s.morning, 'bg-amber-600')}
                    </td>
                    <td className="py-4 px-3 text-center bg-sky-50/20 border-r border-slate-100">
                      {renderDoseCell(s.noon, 'bg-sky-600')}
                    </td>
                    <td className="py-4 px-3 text-center bg-indigo-50/20 border-r border-slate-100">
                      {renderDoseCell(s.night, 'bg-indigo-700')}
                    </td>
                    <td className="no-print py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          isSpeaking
                            ? onStopSpeech()
                            : onSpeakText(`card-${med.lineId}`, s.banglaVoiceText)
                        }
                        aria-label={`Listen for ${med.resolvedDrug.brandName}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50/80 hover:bg-teal-100 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        {isSpeaking ? (
                          <>
                            <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                            শুনুন
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* OFFICIAL MEDICINE PRICES & SAVINGS */}
      <section className="no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'bn' ? 'সরকারি ওষুধের মূল্য ও সাশ্রয়' : 'Official Medicine Prices'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Check if your pharmacy bill is fair and see lower-cost brands with the exact same
              medicine.
            </p>
          </div>

          <div className="shrink-0">
            <label
              htmlFor="pharmacy-bill-input"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Pharmacy Bill (৳)
            </label>
            <input
              id="pharmacy-bill-input"
              type="number"
              min="0"
              step="1"
              value={pharmacyBillInput}
              onChange={(e) => setPharmacyBillInput(e.target.value)}
              placeholder={`e.g. ${Math.round(priceReport.totalStatutoryMrpBdt * 1.2)}`}
              className="w-40 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        {/* Summary Numbers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <div className="text-xs text-slate-400">Official Total</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              ৳{priceReport.totalStatutoryMrpBdt.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Lowest Same-Medicine Option</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-teal-800 mt-1">
              ৳{priceReport.minBioEquivalentTotalBdt.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Possible Savings</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              ৳{priceReport.potentialSavingsBdt.toFixed(0)}{' '}
              <span className="text-sm font-semibold">({priceReport.potentialSavingsPercent}%)</span>
            </div>
          </div>
        </div>

        {overchargeAmount !== null && (
          <div
            role="status"
            className={`flex items-center gap-2.5 p-4 rounded-2xl border text-sm ${
              overchargeAmount > 5
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {overchargeAmount > 5 ? (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Bill looks high:</strong> ৳{parsedQuotedBill.toFixed(0)} is{' '}
                  <strong>৳{overchargeAmount.toFixed(0)} more</strong> than the official price of ৳
                  {priceReport.totalStatutoryMrpBdt.toFixed(0)}.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>
                  ৳{parsedQuotedBill.toFixed(0)} is within the official maximum retail price.
                </span>
              </>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4">Lower-Cost Same Medicine</th>
                <th className="py-3 px-4 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {priceReport.rows.map((row) => (
                <tr key={row.medication.lineId}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">
                      {row.medication.resolvedDrug.brandName}{' '}
                      {row.medication.resolvedDrug.strengthText}
                    </div>
                    <div className="text-xs text-slate-400">৳{row.unitMrpBdt.toFixed(2)} each</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    {row.totalUnits}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    ৳{row.lineTotalBdt.toFixed(0)}
                  </td>
                  <td className="py-3 px-4">
                    {row.cheapestAlternative ? (
                      <div>
                        <div className="font-medium text-teal-900">
                          {row.cheapestAlternative.drug.brandName}{' '}
                          {row.cheapestAlternative.drug.strengthText}
                        </div>
                        <div className="text-xs text-slate-400">
                          ৳{row.cheapestAlternative.drug.unitMrpBdt.toFixed(2)} each ·{' '}
                          {row.cheapestAlternative.drug.manufacturer}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Already lowest</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                    {row.cheapestAlternative ? (
                      <span className="text-emerald-700">
                        ৳{row.cheapestAlternative.savingsBdt.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
