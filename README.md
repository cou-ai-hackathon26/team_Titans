<div align="center">

# 🛡️ OshudhGuard AI
### **An AI Clinical Pharmacist in Every Bangladeshi Smartphone**
*Multimodal BD Prescription Decoder • Blister-Strip Verifier • Cross-Visit Safety Auditor • Bangla Voice Assistant*

[![CoU AI Hackathon 2026](https://img.shields.io/badge/CoU_AI_Hackathon_2026-Team_Titans-0F766E?style=for-the-badge)](https://github.com/cou-ai-hackathon26/team_Titans)
[![Track](https://img.shields.io/badge/Track_01-Healthcare_%26_Wellbeing-1D4ED8?style=for-the-badge)](#)
[![Challenge 1](https://img.shields.io/badge/Challenge_1-Cross--Visit_Audit_✓-16A34A?style=for-the-badge)](#-challenge-round-1-implementations)
[![Challenge 2](https://img.shields.io/badge/Challenge_2-Red--Alert_Hold_✓-16A34A?style=for-the-badge)](#-challenge-round-1-implementations)
[![Bilingual](https://img.shields.io/badge/UI_%26_Voice-EN_%2F_বাংলা-D97706?style=for-the-badge)](#)

**Built by Team Titans** — **MD Ashiqur Rahman**, **MD. Niaj Mahamod**, and **MD. Tareq Rahman Munim**  
**Host: Comilla University (CoU TechNova 2026)**

</div>

---

## 🚨 Why OshudhGuard AI Exists

In Bangladesh, over **70% of outpatient prescriptions** are handwritten with dense clinical shorthand (`1+0+1 a/c`, `BD`, `SOS`, `HS`), while neighborhood pharmacies routinely cut and dispense **loose, unboxed blister strips** without patient leaflets. Combined with **21,000+ look-alike and sound-alike local brand names** across hundreds of manufacturers, everyday patients and low-literacy caregivers face four silent hazards:

| Hazard | What Happens in Real Life | How OshudhGuard AI Stops It |
| :--- | :--- | :--- |
| **1. Multi-Clinic Duplicate Generics** | A patient visits two clinics and gets prescribed **Sergel 20mg** (Healthcare) and **Maxpro 20mg** (Renata)—two different brands hiding the *exact same active ingredient* (*Esomeprazole*). | Merges prescriptions across clinics into one unified active-molecule list and flags accidental double dosing. |
| **2. Unsafe Drug & Health Conflicts** | Painkillers like **Naprosyn 500mg** (*Naproxen*) prescribed alongside **Losardil 50mg** (*Losartan*) in a patient with **Kidney Disease & Hypertension**. | Runs a Graph-RAG interaction & comorbidity audit with plain-language warnings and **Bangla audio playback**. |
| **3. Damaged / Cut Blister Foil False Alarms** | Scissor-cut or glare-washed metallic foil strips hide half the brand imprint—causing naive AI scanners to panic with false red mismatch alarms. | Evaluates foil readability first; **holds back the red alert** when genuinely unreadable and guides the user to retake or check the full box. |
| **4. Shorthand Confusion & Overcharging** | Caregivers cannot decode English dosing shorthand or verify official government MRP prices on loose strips. | Generates a **Morning / Noon / Night (`সকাল / দুপুর / রাত`) Bangla visual schedule** with voice readout, WhatsApp share, and official MRP bill check. |

---

## 🏆 Challenge Round 1 Implementations

During **CoU AI Hackathon 2026 (Challenge Round 1)**, Team Titans was assigned the engineering direction **"Audit prescriptions across visits"** alongside two clinical safety challenges. Both are fully implemented and verifiable inside the app:

### Challenge 1: Cross-Clinic Prescription Audit (`+ Add another clinic`)
> *"Let a caregiver add a prescription from another clinic, so the duplicate-generic and interaction audit spans visits."*

* **How It Works:**
  1. **Scan Visit 1:** The caregiver photographs or uploads the first clinic's prescription on the **Prescription** tab (or selects a clinical preset: *Kidney*, *Heart*, *Pregnancy*).
  2. **Add Visit 2 (`+ Add another clinic`):** Tapping **`+ Add another clinic`** lets the caregiver upload a second prescription from another doctor or clinic.
  3. **Unified Active-Molecule Merge:** Stage 3 entity resolution maps every local brand to its verified DGDA active generic molecule, merging all visits into a single longitudinal regimen.
  4. **Cross-Visit Graph-RAG Audit:** Stage 5 evaluates the combined medicine list against patient health conditions (*e.g., Kidney disease, High blood pressure*), tagging every alert with the **exact clinic name and visit date** plus a **`Listen` (Bangla TTS)** button.
* **Live Clinical Catch Example (Patient: *Md. Abdul Karim, 62y* | Conditions: *Kidney Disease, High Blood Pressure*):**
  * 🔴 **Same Medicine Twice:** `Sergel 20mg` + `Maxpro 20mg` → Both contain **Esomeprazole** (accidental double dosing across clinics).
  * 🔴 **Unsafe Combination:** `Naprosyn 500mg` (*Naproxen*) + `Losardil 50mg` (*Losartan*) → Harms kidneys and impairs blood pressure control.
  * 🔴 **Health Warning (Kidney):** `Naprosyn 500mg` *[Cumilla Medical Center, Kandirpar · 20 Nov 2026]* → NSAID contraindicated for weak kidneys.
  * 🟡 **Health Warning (BP):** `Naprosyn 500mg` → Regular use can elevate blood pressure.
  * 🟡 **Human-in-the-Loop Ambiguity Chooser:** Unclear handwritten lines (e.g., `5. Tab. Mns 10`) prompt the user to confirm the intended medicine rather than guessing blindly.

---

### Challenge 2: Hold the Red Alert on Unreadable Blister Strips
> *"Hold the red mismatch alert when the blister foil is so damaged or cropped that the imprint is genuinely unreadable."*

* **Why Honest Abstention Matters:** A false red alarm destroys user trust, while calling an unreadable strip "safe" is dangerous. OshudhGuard AI enforces a strict **readability gate** before classifying any strip.
* **5-State Blister Verification Matrix (`Check Strip` Tab):**

| Test Scenario | Foil Condition | System Decision | User Experience & Action |
| :--- | :--- | :---: | :--- |
| **`Sergel 20mg`** | Clear imprint, exact brand & dose | 🟢 **GREEN** | Verified exact match with prescription. |
| **`Exium 20mg`** | Clear imprint, bio-equivalent brand | 🟡 **AMBER** | Same active ingredient (*Esomeprazole 20mg*), different brand. |
| **`Sergel 40mg`** | Clear imprint, wrong milligram strength | 🔴 **RED** | **Critical Mismatch:** Prescription says `20mg`, strip says `40mg`. |
| **`Amdocal 5mg`** | Clear imprint, unprescribed medicine | 🔴 **RED** | **Critical Mismatch:** Medicine is not on the prescription. |
| **`Scissor-cut foil`** | Cropped across brand name / metallic glare | ⏸️ **HELD** | **`Strip unreadable — manual check needed` (`Red alert held back`)** — prompts **Retake Photo**, **Upload Clearer Photo**, or check full box, with **Listen in Bangla** & **Anti-Glare Filter** inspection. |

---

## 🖥️ Four Integrated App Sections (`EN / বাংলা` Bilingual Toggle)

1. **📋 Prescription:** Photograph/upload prescriptions, append additional clinics (`+ Add another clinic`), configure health conditions, resolve unclear handwriting safely, and listen to cross-visit safety alerts in Bangla.
2. **💊 Check Strip:** Photograph loose pharmacy blister strips, inspect the CLAHE anti-glare scan, and verify brand/dose accuracy with safe red-alert abstention on damaged foils.
3. **🗓️ Schedule (`ওষুধ খাওয়ার দৈনিক সময়সূচী`):** Auto-generates a color-coded **Morning (`সকাল`) / Noon (`দুপুর`) / Night (`রাত`)** dosage card with meal timing, duration, per-drug **`শুনুন` (Listen)** buttons, **Save Image**, **Print**, **WhatsApp Share**, and a **Pharmacy Bill Fairness Calculator** (e.g., comparing `৳947` official total vs. `৳750` lowest bio-equivalent option = **21% / `৳197` savings**).
4. **🔍 Medicines (`Medicine Lookup`):** Fuzzy/phonetic search across Bangladeshi brands (even rough spellings like `Srgel 20` or `Seklo 20`) showing Bangla names, dosage forms, active ingredients, manufacturers, and official DGDA unit prices (`৳`).

---

## Six-Stage Neuro-Symbolic AI Pipeline

    [Prescription Photo(s) + Blister Strip Image + Health Profile]
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │ Stage 1 & 2: Image Preprocessing & Multimodal OCR      │
      │ • OpenCV deskewing + Vision-Language token extraction  │
      └───────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │ Stage 3: Hybrid Entity Resolution & Ambiguity Gate     │
      │ • BGE-M3 + Levenshtein + Double-Metaphone vs DGDA DB   │
      │ • Human-in-the-loop chooser when handwriting is unclear│
      └───────────────────────────┬────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
    ┌──────────────────────────────┐ ┌──────────────────────────────┐
    │ Stage 4: Blister Verifier    │ │ Stage 5: Cross-Visit Graph   │
    │ • CIE-LAB CLAHE anti-glare   │ │ • Merges multi-clinic visits │
    │ • PaddleOCR foil extraction  │ │ • Duplicate generic & DDI +  │
    │ • Abstains & holds RED alert │ │   comorbidity safety audit   │
    │   on cut/unreadable foils    │ │                              │
    └──────────────┬───────────────┘ └──────────────┬───────────────┘
                   └───────────────┬────────────────┘
                                   ▼
      ┌────────────────────────────────────────────────────────┐
      │ Stage 6: Bangla Schedule Compiler & Voice Synthesis    │
      │ • Morning/Noon/Night visual card + Bangla TTS + MRP    │
      └────────────────────────────────────────────────────────┘

---

## 📂 Repository Structure

    .
    ├── server.ts                      # Node.js / Express backend & Gemini multimodal endpoints
    ├── index.html                     # HTML entry point
    ├── package.json                   # Scripts & dependencies
    ├── tsconfig.json                  # TypeScript configuration
    ├── vite.config.ts                 # Vite bundler configuration
    ├── .env.example                   # Environment template (placeholders only)
    └── src/
        ├── App.tsx                    # Main application shell & EN/বাংলা state
        ├── types/clinical.ts          # Domain models (visits, meds, alerts, foil outcomes)
        ├── data/
        │   ├── dgdaDatabase.ts        # Bangladeshi drug catalog (brands, generics, Bangla names, MRPs)
        │   ├── clinicalGraph.ts       # Drug-drug interaction & comorbidity knowledge graph
        │   └── demoCases.ts           # Multi-clinic & 5-outcome blister strip test presets
        ├── engine/
        │   ├── grounding.ts           # Fuzzy/phonetic DGDA brand grounding & confidence gate
        │   ├── safetyGraph.ts         # Cross-visit duplicate generic, DDI & health risk engine
        │   ├── banglaCompiler.ts      # Bangla schedule & plain-language alert generator
        │   ├── imageProcessing.ts     # Anti-glare & foil readability heuristics
        │   └── *.test.ts              # Unit test suites (grounding, safetyGraph, banglaCompiler)
        ├── components/
        │   ├── ScannerWorkspace.tsx   # Multi-clinic prescription workspace & alert feed
        │   ├── BlisterVerifier.tsx    # Blister-strip verifier with red-alert hold UI
        │   ├── CaregiverCardView.tsx  # Bangla Morning/Noon/Night schedule & bill savings checker
        │   ├── DgdaIndexView.tsx      # Searchable Bangladeshi Medicine Lookup view
        │   ├── PipelineInspector.tsx  # Transparent stage-by-stage AI pipeline inspector
        │   ├── CameraCaptureModal.tsx # Camera capture modal
        │   └── TopBar.tsx             # Navigation & EN/বাংলা toggle
        └── utils/
            ├── plainLanguage.ts       # Patient-friendly clinical explanations
            ├── cardExporter.ts        # Image export, print & WhatsApp share helpers
            ├── storage.ts             # Local visit persistence
            └── voice.ts               # Bangla voice synthesis & audio playback

---

## 🚀 Quick Start (Local Setup)

1. **Clone the repository:**
   `git clone https://github.com/cou-ai-hackathon26/team_Titans.git && cd team_Titans`

2. **Configure environment variables:**
   `cp .env.example .env`
   Add your Gemini API key inside `.env` (never commit `.env` to Git):
   - `GEMINI_API_KEY="your_gemini_api_key_here"`
   - `APP_URL="http://localhost:3000"`

3. **Install dependencies & run:**
   `npm install && npm run dev`

4. **Run automated tests:**
   `npm test`

---

## 🔒 Security & AI Attribution

- **Secret Hygiene:** All API keys are loaded strictly from environment variables (`.env`), excluded via `.gitignore`, and never committed to source control.
- **AI Transparency:** Utilizes Google Gemini multimodal vision-language models (`server.ts`) paired with custom deterministic TypeScript entity grounding, Graph-RAG safety rules, CLAHE/OCR blister verification, and Bangla schedule compilation.
