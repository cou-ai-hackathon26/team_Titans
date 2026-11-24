let currentAudio: HTMLAudioElement | null = null;

export function stopBanglaSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export interface SpeakResult {
  engine: 'gemini-tts' | 'browser-speech' | 'unavailable';
  error?: string;
}

/**
 * Plays natural spoken Bangla via server-side Gemini 3.8 Flash Lite TTS (/api/tts),
 * seamlessly falling back to the browser's Bangla Web Speech API when offline or unavailable.
 */
export async function speakBanglaText(
  text: string,
  options?: { urgent?: boolean; onEnd?: () => void },
): Promise<SpeakResult> {
  stopBanglaSpeech();

  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return { engine: 'unavailable', error: 'Empty text' };
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, urgent: Boolean(options?.urgent) }),
    });

    if (response.ok) {
      const data = (await response.json()) as { audioBase64?: string; mimeType?: string };
      if (data.audioBase64) {
        const audio = new Audio(
          `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`,
        );
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          options?.onEnd?.();
        };
        audio.onerror = () => {
          currentAudio = null;
          speakWithBrowserFallback(trimmed, options?.onEnd);
        };
        await audio.play();
        return { engine: 'gemini-tts' };
      }
    }
  } catch {
    // Network or Gemini TTS unavailable — fall back cleanly to offline browser TTS
  }

  return speakWithBrowserFallback(trimmed, options?.onEnd);
}

function speakWithBrowserFallback(text: string, onEnd?: () => void): SpeakResult {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return { engine: 'unavailable', error: 'Speech synthesis not supported in this browser.' };
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const banglaVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('bn-bd')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('bn'));

    if (banglaVoice) {
      utterance.voice = banglaVoice;
      utterance.lang = banglaVoice.lang;
    } else {
      utterance.lang = 'bn-BD';
    }
    utterance.rate = 0.92;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
    return { engine: 'browser-speech' };
  } catch {
    onEnd?.();
    return { engine: 'unavailable', error: 'Unable to start speech playback.' };
  }
}
