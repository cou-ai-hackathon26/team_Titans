import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParsedGeminiError {
  status: number;
  code: number;
  rawStatus: string;
  userMessage: string;
  isTransient: boolean;
}

function parseGeminiError(err: unknown, fallbackMessage: string): ParsedGeminiError {
  const rawMessage = err instanceof Error ? err.message : String(err ?? '');
  let code = (err as { status?: number; code?: number })?.status ??
    (err as { code?: number })?.code ??
    0;
  let rawStatus = '';
  let innerMessage = rawMessage;

  // @google/genai often serializes upstream API errors as JSON inside Error.message
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') code = parsed.error.code;
        if (typeof parsed.error.status === 'string') rawStatus = parsed.error.status;
        if (typeof parsed.error.message === 'string') innerMessage = parsed.error.message;
      }
    } catch {
      // Ignore malformed JSON substrings
    }
  }

  const combined = `${code} ${rawStatus} ${innerMessage}`.toLowerCase();
  const isBusy =
    code === 503 ||
    rawStatus === 'UNAVAILABLE' ||
    combined.includes('high demand') ||
    combined.includes('overloaded') ||
    combined.includes('temporarily unavailable');
  const isRateLimited =
    code === 429 ||
    rawStatus === 'RESOURCE_EXHAUSTED' ||
    combined.includes('quota') ||
    combined.includes('rate limit');
  const isNetwork =
    combined.includes('etimedout') ||
    combined.includes('econnreset') ||
    combined.includes('fetch failed') ||
    combined.includes('socket hang up');
  const isAuth =
    code === 401 ||
    code === 403 ||
    rawStatus === 'PERMISSION_DENIED' ||
    combined.includes('api_key_invalid') ||
    combined.includes('api key not valid');

  if (isBusy) {
    return {
      status: 503,
      code: 503,
      rawStatus: rawStatus || 'UNAVAILABLE',
      userMessage:
        'The reading service is temporarily busy due to high demand. Please wait a few seconds and tap Try Again.',
      isTransient: true,
    };
  }

  if (isRateLimited) {
    return {
      status: 429,
      code: 429,
      rawStatus: rawStatus || 'RESOURCE_EXHAUSTED',
      userMessage:
        'Too many requests right now. Please wait a moment and try again.',
      isTransient: true,
    };
  }

  if (isAuth) {
    return {
      status: 403,
      code: 403,
      rawStatus: rawStatus || 'PERMISSION_DENIED',
      userMessage:
        'The AI service key is invalid or missing permissions. Please check GEMINI_API_KEY in Settings > Secrets.',
      isTransient: false,
    };
  }

  if (isNetwork) {
    return {
      status: 503,
      code: 503,
      rawStatus: 'NETWORK_ERROR',
      userMessage:
        'Connection was briefly interrupted while reading the photo. Please tap Try Again.',
      isTransient: true,
    };
  }

  return {
    status: code >= 400 && code < 600 ? code : 500,
    code: code || 500,
    rawStatus: rawStatus || 'ERROR',
    userMessage: innerMessage && innerMessage.length < 220 ? innerMessage : fallbackMessage,
    isTransient: false,
  };
}

/**
 * Executes a Gemini model call with exponential backoff on 503/429/transient errors,
 * and seamlessly falls back to a secondary model when the primary model is experiencing high demand.
 */
async function executeWithRetryAndFallback<T>(
  primaryLabel: string,
  primaryFn: () => Promise<T>,
  fallback?: { label: string; fn: () => Promise<T> },
  maxPrimaryAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt++) {
    try {
      return await primaryFn();
    } catch (err) {
      lastError = err;
      const info = parseGeminiError(err, 'AI request failed.');
      if (!info.isTransient) {
        throw err;
      }
      if (attempt < maxPrimaryAttempts) {
        const delayMs = Math.round(700 * Math.pow(2, attempt - 1) + Math.random() * 250);
        console.warn(
          `[OshudhGuard] ${primaryLabel} transient error (${info.rawStatus}), retrying attempt ${attempt + 1}/${maxPrimaryAttempts} in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }
  }

  if (fallback) {
    console.warn(
      `[OshudhGuard] ${primaryLabel} remained busy; switching to fallback model ${fallback.label}`,
    );
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await fallback.fn();
      } catch (fallbackErr) {
        lastError = fallbackErr;
        const info = parseGeminiError(fallbackErr, 'Fallback AI request failed.');
        if (!info.isTransient || attempt === 2) {
          throw fallbackErr;
        }
        await sleep(900);
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      ),
    });
  });

  /**
   * Stage 2: Multimodal VLM Prescription Token & Clinical Prior Extraction
   * Extracts Zone A patient context + Zone B/C top-3 transcription hypotheses per Rx line.
   */
  app.post('/api/analyze-prescription', async (req, res) => {
    try {
      const { imageDataUrl } = req.body as { imageDataUrl?: string };
      if (!imageDataUrl) {
        res.status(400).json({ error: 'Missing prescription imageDataUrl.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Secrets or use the built-in sample prescriptions.',
        });
        return;
      }

      const parsed = parseDataUrl(imageDataUrl);
      if (!parsed) {
        res.status(400).json({ error: 'Invalid base64 image data URL.' });
        return;
      }

      const contents = {
        parts: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.data,
            },
          },
          {
            text:
              'You are OshudhGuard AI Stage 2 Clinical VLM for Bangladeshi handwritten and printed outpatient prescriptions. ' +
              'Segment the image into Zone A (patient age, sex, doctor name, diagnosis/comorbidity notes like CKD, DM, HTN, Pregnancy, Asthma, Peptic Ulcer) ' +
              'and Zone B/C (each horizontal Rx medication line + Bangladeshi shorthand schedule like 1+0+1 a/c 30m, 1+1+1 p/c, BD, TDS, HS, SOS, T/S, duration in days). ' +
              'For EVERY medication line, provide the raw OCR reading AND top-3 plausible Bangladeshi trade brand transcription hypotheses (do not hallucinate non-existent strengths). ' +
              'Also return approximate normalized bounding box [yMin, xMin, yMax, xMax] in 0..1000 for each medication line.',
          },
        ],
      };

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          patientName: { type: Type.STRING },
          age: { type: Type.INTEGER },
          sex: { type: Type.STRING },
          doctorName: { type: Type.STRING },
          clinicName: { type: Type.STRING },
          detectedConditions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          medications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ocrRaw: { type: Type.STRING },
                hypotheses: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                dosageFormHint: { type: Type.STRING },
                strengthHint: { type: Type.STRING },
                scheduleShorthand: { type: Type.STRING },
                durationDays: { type: Type.INTEGER },
                bbox: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
              required: ['ocrRaw', 'hypotheses', 'scheduleShorthand'],
            },
          },
        },
        required: ['detectedConditions', 'medications'],
      };

      const response = await executeWithRetryAndFallback(
        'gemini-4-hydrogen (rx)',
        () =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        {
          label: 'gemini-3.1-flash-lite (rx)',
          fn: () =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: {
                responseMimeType: 'application/json',
                responseSchema,
              },
            }),
        },
      );

      const rawText = (response.text ?? '{}').trim();
      const payload = JSON.parse(rawText);
      res.json(payload);
    } catch (err) {
      const info = parseGeminiError(err, 'Could not read the prescription photo right now. Please try again.');
      res.status(info.status).json({ error: info.userMessage, retryable: info.isTransient });
    }
  });

  /**
   * Stage 4: Physical Blister-Strip Metallic Foil OCR
   * Decodes repeated diagonal foil imprints from CLAHE-processed loose blister strip images.
   */
  app.post('/api/analyze-blister', async (req, res) => {
    try {
      const { imageDataUrl } = req.body as { imageDataUrl?: string };
      if (!imageDataUrl) {
        res.status(400).json({ error: 'Missing blister strip imageDataUrl.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Secrets or test with the built-in strip samples.',
        });
        return;
      }

      const parsed = parseDataUrl(imageDataUrl);
      if (!parsed) {
        res.status(400).json({ error: 'Invalid base64 image data URL.' });
        return;
      }

      const contents = {
        parts: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.data,
            },
          },
          {
            text:
              'You are OshudhGuard AI Stage 4 Blister-Strip Foil Verifier for Bangladeshi loose cut metallic medicine strips. ' +
              'First evaluate foil imprint readability honestly: if scissor cuts, severe metallic glare, crumpling, or blur make the brand name or strength genuinely unreadable, set readability="UNREADABLE", isCroppedOrDamaged=true, ocrConfidence<0.5, and explain why in readabilityReason — DO NOT guess or hallucinate a medicine name. ' +
              'If clearly readable, read the repeated diagonal typography printed on the metallic foil (brand name, milligram strength, dosage form like Tablet/Capsule, generic name if visible, and manufacturer). ' +
              'Pay extreme attention to the exact milligram strength (e.g. 20mg vs 40mg, 250mg vs 500mg).',
          },
        ],
      };

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          ocrStripRaw: { type: Type.STRING },
          brandGuess: { type: Type.STRING },
          genericVisible: { type: Type.STRING },
          dosageFormHint: { type: Type.STRING },
          strengthHint: { type: Type.STRING },
          manufacturerHint: { type: Type.STRING },
          readability: { type: Type.STRING, enum: ['CLEAR', 'PARTIAL', 'UNREADABLE'] },
          isCroppedOrDamaged: { type: Type.BOOLEAN },
          ocrConfidence: { type: Type.NUMBER },
          readabilityReason: { type: Type.STRING },
        },
        required: ['ocrStripRaw', 'brandGuess', 'strengthHint', 'readability', 'isCroppedOrDamaged', 'ocrConfidence'],
      };

      const response = await executeWithRetryAndFallback(
        'gemini-4-hydrogen (blister)',
        () =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        {
          label: 'gemini-3.1-flash-lite (blister)',
          fn: () =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: {
                responseMimeType: 'application/json',
                responseSchema,
              },
            }),
        },
      );

      const rawText = (response.text ?? '{}').trim();
      const payload = JSON.parse(rawText);
      res.json(payload);
    } catch (err) {
      const info = parseGeminiError(err, 'Could not read the medicine strip photo right now. Please try again.');
      res.status(info.status).json({ error: info.userMessage, retryable: info.isTransient });
    }
  });

  /**
   * Stage 6: Natural Bangla Clinical Voice Synthesis via Gemini 3.8 Flash Lite TTS
   * Returns complete unary WAV base64 audio (audio/wav, 24kHz mono 16-bit).
   */
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, urgent } = req.body as { text?: string; urgent?: boolean };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Missing text for Bangla speech synthesis.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Gemini TTS unavailable; client can fall back to browser speech synthesis.',
        });
        return;
      }

      const styleInstruction = urgent
        ? 'Clear, urgent, empathetic clinical pharmacist alert in natural Bangladeshi Bangla'
        : 'Warm, clear, slow and patient-friendly Bangladeshi Bangla clinical pharmacist voice for elderly caregivers';

      const response = await executeWithRetryAndFallback(
        'gemini-3.8-flash-lite-tts',
        () =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: text.trim(),
                    speechMetadata: {
                      style: styleInstruction,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
          }),
        undefined,
        2,
      );

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'TTS model returned no audio data.' });
        return;
      }

      res.json({
        mimeType: 'audio/wav',
        audioBase64: base64Audio,
      });
    } catch (err) {
      const info = parseGeminiError(err, 'Bangla voice synthesis is temporarily unavailable.');
      res.status(info.status).json({ error: info.userMessage, retryable: info.isTransient });
    }
  });

  /**
   * Voice Comorbidity Input: Transcribe spoken Bangla/English comorbidity notes
   * using Gemini 3.5 Transcribe.
   */
  app.post('/api/transcribe-comorbidities', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };
      if (!audioBase64) {
        res.status(400).json({ error: 'Missing audioBase64.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({ error: 'Gemini API key is not configured.' });
        return;
      }

      const response = await executeWithRetryAndFallback(
        'gemini-3.5-transcribe',
        () =>
          ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'audio/webm',
                    data: audioBase64,
                  },
                },
                {
                  text: 'Transcribe this patient health condition note (may be in Bangla or English).',
                },
              ],
            },
          }),
        undefined,
        2,
      );

      res.json({ transcript: (response.text ?? '').trim() });
    } catch (err) {
      const info = parseGeminiError(err, 'Voice note could not be transcribed right now.');
      res.status(info.status).json({ error: info.userMessage, retryable: info.isTransient });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OshudhGuard AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
