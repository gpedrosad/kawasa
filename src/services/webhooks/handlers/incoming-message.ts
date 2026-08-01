import { logger } from "@/lib/logger";
import {
  isSuppTrigger,
  replySuppWithVoiceNote,
} from "@/services/automations/supp-voice";
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

  const { message, conversation, isNewConversation } = normalized;

  logger.info("Mensaje entrante recibido", {
    messageId: message.id,
    from: message.from,
    type: message.type,
    conversationId: conversation?.id,
    isNewConversation,
    textPreview: message.text?.slice(0, 120),
  });

  if (isSuppTrigger(message.text) && message.from) {
    try {
      await replySuppWithVoiceNote({
        to: message.from,
        messageId: message.id,
      });
    } catch (error) {
      logger.error("Falló automatización supp → nota de voz", {
        messageId: message.id,
        from: message.from,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
