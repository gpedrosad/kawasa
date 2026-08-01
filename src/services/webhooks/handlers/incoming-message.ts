import { logger } from "@/lib/logger";
import { normalizeIncomingMessage } from "@/services/webhooks/normalize";
import type { WebhookEvent } from "@/types/webhook";

/**
 * Procesa mensajes entrantes.
 * Aquí conectarás CRM, IA, automatizaciones, etc.
 */
export async function handleIncomingMessage(
  event: WebhookEvent,
): Promise<void> {
  const normalized = normalizeIncomingMessage(event);

  if (!normalized) {
    logger.warn("message.received sin payload de mensaje", {
      type: event.type,
    });
    return;
  }

  logger.info("Mensaje entrante recibido", {
    messageId: normalized.message.id,
    from: normalized.message.from,
    type: normalized.message.type,
    conversationId: normalized.conversation?.id,
    isNewConversation: normalized.isNewConversation,
    textPreview: normalized.message.text?.slice(0, 120),
  });

  // TODO: persistir con MessageRepository / ContactRepository
  // TODO: encolar respuesta automática / AIProvider
}
