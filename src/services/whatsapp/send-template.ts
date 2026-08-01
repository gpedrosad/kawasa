import type { SendMessageResponse } from "@kapso/whatsapp-cloud-api";
import { getKapsoClient, getKapsoPhoneNumberId } from "@/lib/kapso";
import { logger } from "@/lib/logger";
import type { SendTemplateInput } from "@/types/whatsapp";
import { assertValidInternationalPhone } from "@/utils/phone";

export async function sendTemplate(
  input: SendTemplateInput,
): Promise<SendMessageResponse> {
  const to = assertValidInternationalPhone(input.to);
  const phoneNumberId = getKapsoPhoneNumberId();
  const client = getKapsoClient();

  logger.info("Enviando template WhatsApp", {
    to,
    phoneNumberId,
    name: input.name,
    language: input.language,
  });

  return client.messages.sendTemplate({
    phoneNumberId,
    to,
    template: {
      name: input.name,
      language: { code: input.language },
      components: input.components,
    },
  });
}
