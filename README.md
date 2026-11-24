# OshudhGuard AI

**Multimodal BD Prescription Decoder, Blister-Strip Verifier, Cross-Visit Clinical Safety Auditor & Bangla Voice Medication Assistant**

Built by **Team Titans** (**Team #32** — CoU AI Hackathon 2026)  
**Team Members:** MD. Ashiqur Rahman (Team Leader), MD. Niaj Mahamod, and MD. Tareq Rahman Munim

---

## 1. Problem Statement & Clinical Context

In Bangladesh, over 70% of outpatient consultations conclude with handwritten or shorthand-heavy prescriptions containing clinical abbreviations (`1+0+1 a/c`, `BD`, `SOS`, `Stat`). Patients routinely take these slips to busy neighborhood pharmacies where trained Grade-A pharmacists are scarce and loose, unboxed medicine blister strips are cut and dispensed without printed patient leaflets. Combined with more than 21,000 look-alike and sound-alike local brand names registered under the Directorate General of Drug Administration (DGDA), patients and low-literacy caregivers face four critical safety hazards:

1. **Wrong-Drug or Wrong-Strength Dispensing:** Illegible doctor handwriting and look-alike trade names lead to incorrect medications or milligram strengths being handed over at the counter.
2. **Cross-Visit Duplicate-Generic Overdoses:** Patients visiting multiple specialists or clinics often receive different brand names containing the exact same active generic molecule (e.g., two brands of *Esomeprazole* or *Paracetamol*), causing silent cumulative toxicity.
3. **Unflagged Drug–Drug Interactions (DDIs) & Comorbidity Hazards:** Polypharmacy regimens frequently overlook dangerous interactions or contraindications for patients with **Kidney Disease (CKD)**, **Diabetes**, or **Pregnancy**.
4. **Dosing Confusion & MRP Overcharging:** Elderly patients and caregivers struggle to interpret English clinical shorthand at home or verify official government Maximum Retail Prices (MRP) on cut blister strips.

---

## 2. Solution Overview

**OshudhGuard AI** is a mobile-first clinical medication safety assistant designed specifically for Bangladesh's pharmaceutical ecosystem. Rather than relying on unconstrained generative text, it combines computer vision, deterministic hybrid entity resolution against local drug data, physical blister-strip verification, cross-visit safety graph auditing, and Bangla voice synthesis inside an inspectable multi-stage pipeline.

### Core Capabilities

1. **Multimodal Prescription Decoding (`ScannerWorkspace.tsx`, `CameraCaptureModal.tsx`, `server.ts`):**
   - Captures or uploads handwritten/printed prescription photos alongside optional patient comorbidity toggles (Kidney Disease, Diabetes, Pregnancy).
   - Extracts medicine lines, dosage forms, milligram strengths, frequency schedules (`1+0+1`), meal-timing instructions (`a/c`, `p/c`), and duration.
2. **Zero-Hallucination Hybrid Grounding (`src/engine/grounding.ts`, `src/data/dgdaDatabase.ts`, `DgdaIndexView.tsx`):**
   - Deterministically maps raw OCR drug tokens to verified Bangladeshi brand entries, active generic molecules, therapeutic classes, and official DGDA MRPs using combined semantic, character-edit, and phonetic similarity scoring.
   - Flags low-confidence or ambiguous tokens for human confirmation instead of guessing.
3. **Physical Blister-Strip Verification with Readability Abstention (`src/components/BlisterVerifier.tsx`, `src/engine/imageProcessing.ts`):**
   - Inspects photos of dispensed medicine blister foils to verify whether the physical strip matches the prescribed brand, active generic, and milligram strength (`EXACT_MATCH`, `GENERIC_SUBSTITUTE`, or `CRITICAL_MISMATCH`).
   - **Safe Uncertainty Abstention:** Holds back red mismatch alerts when a cut, crumpled, or glare-obscured blister foil is genuinely unreadable, preventing false alarms and prompting the user to retake the photo or inspect an uncut strip.
4. **Cross-Visit / Multi-Clinic Clinical Safety Audit (`src/engine/safetyGraph.ts`, `src/data/clinicalGraph.ts`):**
   - Allows caregivers to add prescriptions from multiple clinics or prior visits (`PrescriptionVisit`) so duplicate-generic detection, drug–drug interaction (DDI) checks, and comorbidity warnings span across visits rather than checking a single slip in isolation.
5. **Bangla Caregiver Card & Voice Guidance (`CaregiverCardView.tsx`, `src/engine/banglaCompiler.ts`, `src/utils/plainLanguage.ts`, `src/utils/cardExporter.ts`, `src/utils/voice.ts`):**
   - Translates English clinical shorthand into a color-coded **Morning / Noon / Night** visual caregiver schedule card with plain-language instructions, exportable summary cards, and spoken **Bangla** audio playback.
6. **Transparent Pipeline Inspector (`src/components/PipelineInspector.tsx`):**
   - Exposes intermediate extraction, grounding confidence scores, safety graph edges, and verification decisions for clinical auditability and live judging inspection.

---

## 3. System Architecture & Pipeline Stages

```text
[Prescription Image(s) + Blister Foil Photo + Comorbidity Profile]
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Stage 1: Image Preprocessing & Layout Segmentation      │
   │ (src/engine/imageProcessing.ts, server.ts)              │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Stage 2: Multimodal Vision-Language Extraction          │
   │ Extracts raw drug names, mg strength, dosage & timing   │
   └────────────────────────────┬────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Stage 3: Hybrid Drug Grounding & Uncertainty Gate       │
   │ (src/engine/grounding.ts + src/data/dgdaDatabase.ts)    │
   │ Maps trade names → active generics & official DGDA MRP  │
   └────────────────────────────┬────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ Stage 4A: Blister-Strip CV &  │ │ Stage 4B: Cross-Visit Safety  │
│ Readability Abstention Gate   │ │ Graph & DDI / Comorbidity     │
│ (BlisterVerifier.tsx)         │ │ Audit (safetyGraph.ts)        │
│ • Holds Red Alert if foil is  │ │ • Spans multi-clinic visits   │
│   cut, damaged, or unreadable │ │ • Flags duplicate generics    │
└───────────────┬───────────────┘ └───────────────┬───────────────┘
                └───────────────┬───────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────┐
   │ Stage 5: Bangla Caregiver Schedule & Voice Synthesis    │
   │ (banglaCompiler.ts, CaregiverCardView.tsx, voice.ts)    │
   └─────────────────────────────────────────────────────────┘
