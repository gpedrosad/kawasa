import { logger } from "@/lib/logger";
import type { WebhookEvent } from "@/types/webhook";

/**
 * Procesa estados de mensajes: sent / delivered / read / failed.
 */
export async function handleStatus(event: WebhookEvent): Promise<void> {
  logger.info("Actualización de estado de mensaje", {
    type: event.type,
    messageId: event.message?.id,
    status: event.message?.kapso?.status,
    to: event.message?.to,
    conversationId: event.conversation?.id,
  });

  // TODO: actualizar MessageRepository con el nuevo status
}
