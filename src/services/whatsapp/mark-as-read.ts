import type { GraphSuccessResponse } from "@kapso/whatsapp-cloud-api";
import { getKapsoClient, getKapsoPhoneNumberId } from "@/lib/kapso";
import { logger } from "@/lib/logger";
import type { MarkAsReadInput } from "@/types/whatsapp";

export async function markAsRead(
  input: MarkAsReadInput,
): Promise<GraphSuccessResponse> {
  const phoneNumberId = getKapsoPhoneNumberId();
  const client = getKapsoClient();

  logger.debug("Marcando mensaje como leído", {
    phoneNumberId,
    messageId: input.messageId,
  });

  return client.messages.markRead({
    phoneNumberId,
    messageId: input.messageId,
    typingIndicator: input.typingIndicator ? { type: "text" } : undefined,
  });
}
