import { logger } from "@/lib/logger";
import { maybeQualifyLead } from "@/services/attribution/qualify-lead";
import {
  isSuppTrigger,
  replySuppWithVoiceNote,
} from "@/services/automations/supp-voice";
import { persistIncomingMessage } from "@/services/crm/persist-incoming";
import { normalizeIncomingMessage } from "@/services/webhooks/normalize";
import type { WebhookEvent } from "@/types/webhook";

/**
 * Procesa mensajes entrantes.
 * Persistencia KaWa + automatizaciones.
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

  let persisted: Awaited<ReturnType<typeof persistIncomingMessage>> = null;
  try {
    persisted = await persistIncomingMessage({
      message,
      conversation,
      profileName: conversation?.contactName,
    });
  } catch (error) {
    logger.error("Falló persistencia en KaWa", {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (persisted) {
    try {
      await maybeQualifyLead({
        contactId: persisted.contactId,
        conversationId: persisted.conversationId,
        text: message.text,
      });
    } catch (error) {
      logger.error("Falló la calificación automática del lead", {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
