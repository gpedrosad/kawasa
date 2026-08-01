import type { SendMessageResponse } from "@kapso/whatsapp-cloud-api";
import { getKapsoClient, getKapsoPhoneNumberId } from "@/lib/kapso";
import { logger } from "@/lib/logger";
import type { MediaSource, SendAudioInput } from "@/types/whatsapp";
import { ValidationError } from "@/utils/errors";
import { assertValidInternationalPhone } from "@/utils/phone";

function resolveMediaSource(input: SendAudioInput): MediaSource {
  if (input.mediaId && input.audioUrl) {
    throw new ValidationError(
      "Usa solo uno: mediaId (MEDIA_ID) o audioUrl (LINK)",
    );
  }

  if (input.mediaId) {
    return { kind: "id", id: input.mediaId };
  }

  if (input.audioUrl) {
    return { kind: "link", link: input.audioUrl };
  }

  throw new ValidationError(
    "Debes enviar audioUrl (LINK) o mediaId (MEDIA_ID)",
  );
}

/**
 * Envía audio. Soporta LINK (`audioUrl`) y MEDIA_ID (`mediaId`).
 * Con `voice: true` se envía como nota de voz.
 */
export async function sendAudio(
  input: SendAudioInput,
): Promise<SendMessageResponse> {
  const to = assertValidInternationalPhone(input.to);
  const source = resolveMediaSource(input);
  const voice = input.voice ?? true;
  const phoneNumberId = getKapsoPhoneNumberId();
  const client = getKapsoClient();

  logger.info("Enviando audio WhatsApp", {
    to,
    phoneNumberId,
    voice,
    source: source.kind,
  });

  const audio =
    source.kind === "id"
      ? { id: source.id, voice }
      : { link: source.link, voice };

  return client.messages.sendAudio({
    phoneNumberId,
    to,
    audio,
  });
}
