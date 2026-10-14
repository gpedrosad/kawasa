import { logger } from "@/lib/logger";
import { persistOutboundMessage } from "@/services/crm/persist-outbound";
import { normalizeIncomingMessage } from "@/services/webhooks/normalize";
import type { WebhookEvent } from "@/types/webhook";

/**
 * Procesa estados de mensajes: sent / delivered / read / failed.
 * Guarda en KaWa los mensajes salientes (flujo, API o escritos desde la app).
 */
export async function handleStatus(event: WebhookEvent): Promise<void> {
  const normalized = normalizeIncomingMessage(event);
  const eventStatus = event.type.split(".").pop();

  logger.info("Actualización de estado de mensaje", {
    type: event.type,
    messageId: normalized?.message.id,
    direction: normalized?.message.direction,
    origin: normalized?.message.origin,
    conversationId: normalized?.conversation?.id,
  });

  if (!normalized || normalized.message.direction !== "outbound") {
    return;
  }

  try {
    await persistOutboundMessage({
      message: normalized.message,
      conversation: normalized.conversation,
      eventStatus,
    });
  } catch (error) {
    logger.error("Falló persistencia de mensaje saliente en KaWa", {
      messageId: normalized.message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
