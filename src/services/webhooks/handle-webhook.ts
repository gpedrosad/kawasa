import { logger } from "@/lib/logger";
import { handleConversation } from "@/services/webhooks/handlers/conversation";
import { handleIncomingMessage } from "@/services/webhooks/handlers/incoming-message";
import { handleStatus } from "@/services/webhooks/handlers/status";
import { parseWebhookBody } from "@/services/webhooks/normalize";
import type { WebhookEvent, WebhookEventType } from "@/types/webhook";

function normalizeEventName(type: WebhookEventType): string {
  return type.replace(/^whatsapp\./, "");
}

async function dispatchSingle(event: WebhookEvent): Promise<void> {
  const name = normalizeEventName(event.type);

  switch (name) {
    case "message.received":
      await handleIncomingMessage(event);
      break;

    case "message.sent":
    case "message.delivered":
    case "message.read":
    case "message.failed":
      await handleStatus(event);
      break;

    case "conversation.created":
    case "conversation.ended":
    case "conversation.inactive":
    case "conversation.updated":
      await handleConversation(event);
      break;

    default:
      logger.warn("Evento de webhook no manejado", { type: event.type });
  }
}

/**
 * Dispatcher de webhooks Kapso.
 * Deriva automáticamente a handlers por tipo de evento.
 */
export async function handleWebhook(
  body: Record<string, unknown>,
  headers: WebhookEvent["headers"],
): Promise<void> {
  const event = parseWebhookBody(body, headers);

  if (event.batch && event.data?.length) {
    logger.info("Procesando batch de webhooks", {
      count: event.data.length,
      type: event.type,
    });

    for (const item of event.data) {
      await dispatchSingle(item);
    }
    return;
  }

  await dispatchSingle(event);
}
