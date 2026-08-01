import type { SendMessageResponse } from "@kapso/whatsapp-cloud-api";
import { getKapsoClient, getKapsoPhoneNumberId } from "@/lib/kapso";
import { logger } from "@/lib/logger";
import type { SendTextInput } from "@/types/whatsapp";
import { assertValidInternationalPhone } from "@/utils/phone";

export async function sendText(
  input: SendTextInput,
): Promise<SendMessageResponse> {
  const to = assertValidInternationalPhone(input.to);
  const phoneNumberId = getKapsoPhoneNumberId();
  const client = getKapsoClient();

  logger.info("Enviando texto WhatsApp", { to, phoneNumberId });

  return client.messages.sendText({
    phoneNumberId,
    to,
    body: input.text,
    previewUrl: input.previewUrl,
    contextMessageId: input.contextMessageId,
  });
}
