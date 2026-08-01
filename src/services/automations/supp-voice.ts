import { logger } from "@/lib/logger";
import { markAsRead, sendAudio } from "@/services/whatsapp";
import { getPublicAppUrl } from "@/utils/app-url";

const SUPP_PATTERN = /^supp[!?.]*$/i;
const DEFAULT_VOICE_PATH = "/sounds/supp-voice.ogg";

export function isSuppTrigger(text: string | undefined): boolean {
  if (!text) {
    return false;
  }

  return SUPP_PATTERN.test(text.trim());
}

export function getSuppVoiceAudioUrl(): string {
  const override = process.env.SUPP_VOICE_AUDIO_URL?.trim();
  if (override) {
    return override;
  }

  return `${getPublicAppUrl()}${DEFAULT_VOICE_PATH}`;
}

/**
 * Responde "supp" con una nota de voz (voice: true → burbuja de audio grabado).
 */
export async function replySuppWithVoiceNote(input: {
  to: string;
  messageId: string;
}): Promise<void> {
  const audioUrl = getSuppVoiceAudioUrl();

  logger.info("Trigger supp: enviando nota de voz", {
    to: input.to,
    messageId: input.messageId,
    audioUrl,
  });

  try {
    await markAsRead({
      messageId: input.messageId,
      typingIndicator: true,
    });
  } catch (error) {
    logger.warn("No se pudo marcar como leído antes del audio supp", {
      messageId: input.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await sendAudio({
    to: input.to,
    audioUrl,
    voice: true,
  });
}
