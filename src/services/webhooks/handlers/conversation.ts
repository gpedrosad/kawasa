import { logger } from "@/lib/logger";
import { normalizeConversation } from "@/services/webhooks/normalize";
import type { WebhookEvent } from "@/types/webhook";

/**
 * Procesa eventos de conversación: created / updated / ended / inactive.
 */
export async function handleConversation(event: WebhookEvent): Promise<void> {
  const conversation = normalizeConversation(event.conversation);

  logger.info("Evento de conversación", {
    type: event.type,
    conversationId: conversation?.id,
    phoneNumber: conversation?.phoneNumber,
    status: conversation?.status,
  });

  // TODO: sincronizar ConversationRepository
}
