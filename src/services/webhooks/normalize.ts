import type {
  Conversation,
  IncomingMessage,
  MessageDirection,
  MessageType,
} from "@/types/whatsapp";
import type {
  NormalizedIncomingPayload,
  WebhookConversationPayload,
  WebhookEvent,
  WebhookMessagePayload,
} from "@/types/webhook";
import {
  asRecord,
  pickBoolean,
  pickNumber,
  pickString,
} from "@/utils/object";

function asMessageType(value: string | undefined): MessageType {
  switch (value) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
    case "location":
    case "contacts":
    case "interactive":
    case "template":
    case "reaction":
      return value;
    default:
      return "unknown";
  }
}

function readKapso(message: Record<string, unknown>) {
  const kapso = asRecord(message.kapso) ?? {};
  const mediaData = asRecord(kapso.media_data) ?? asRecord(kapso.mediaData) ?? {};
  const transcript = asRecord(kapso.transcript) ?? {};

  return {
    direction: pickString(kapso, "direction") as MessageDirection | undefined,
    status: pickString(kapso, "status"),
    content: pickString(kapso, "content"),
    mediaUrl: pickString(kapso, "media_url", "mediaUrl"),
    mediaFilename: pickString(mediaData, "filename"),
    mediaContentType: pickString(mediaData, "content_type", "contentType"),
    mediaByteSize: pickNumber(mediaData, "byte_size", "byteSize"),
    mediaDataUrl: pickString(mediaData, "url"),
    transcriptText: pickString(transcript, "text"),
  };
}

function extractText(message: Record<string, unknown>): string | undefined {
  const text = asRecord(message.text);
  const kapso = readKapso(message);
  return pickString(text ?? {}, "body") ?? kapso.content ?? kapso.transcriptText;
}

function extractMedia(message: Record<string, unknown>) {
  const type = pickString(message, "type");
  const kapso = readKapso(message);

  const fromBlock = (blockName: string) => {
    const block = asRecord(message[blockName]);
    if (!block) {
      return undefined;
    }

    return {
      id: pickString(block, "id"),
      link: pickString(block, "link"),
      caption: pickString(block, "caption"),
      filename: pickString(block, "filename") ?? kapso.mediaFilename,
      voice: pickBoolean(block, "voice"),
      url: kapso.mediaUrl ?? kapso.mediaDataUrl,
      mimeType: kapso.mediaContentType,
      fileSize: kapso.mediaByteSize,
    };
  };

  if (type === "audio") return fromBlock("audio");
  if (type === "image") return fromBlock("image");
  if (type === "video") return fromBlock("video");
  if (type === "document") return fromBlock("document");
  return undefined;
}

export function normalizeConversation(
  conversationRaw: unknown,
): Conversation | undefined {
  const conversation = asRecord(conversationRaw);
  if (!conversation) {
    return undefined;
  }

  const kapso = asRecord(conversation.kapso) ?? {};
  const id = pickString(conversation, "id");
  if (!id) {
    return undefined;
  }

  return {
    id,
    phoneNumber: pickString(conversation, "phone_number", "phoneNumber"),
    phoneNumberId: pickString(conversation, "phone_number_id", "phoneNumberId"),
    status: pickString(conversation, "status"),
    contactName: pickString(kapso, "contact_name", "contactName"),
    lastActiveAt: pickString(conversation, "last_active_at", "lastActiveAt"),
    createdAt: pickString(conversation, "created_at", "createdAt"),
    updatedAt: pickString(conversation, "updated_at", "updatedAt"),
    metadata: asRecord(conversation.metadata),
    messagesCount: pickNumber(kapso, "messages_count", "messagesCount"),
    lastMessageId: pickString(kapso, "last_message_id", "lastMessageId") ?? null,
    lastMessageType:
      pickString(kapso, "last_message_type", "lastMessageType") ?? null,
    lastMessageText:
      pickString(kapso, "last_message_text", "lastMessageText") ?? null,
    lastInboundAt: pickString(kapso, "last_inbound_at", "lastInboundAt") ?? null,
    lastOutboundAt:
      pickString(kapso, "last_outbound_at", "lastOutboundAt") ?? null,
  };
}

export function normalizeIncomingMessage(
  event: WebhookEvent,
): NormalizedIncomingPayload | null {
  const message = asRecord(event.raw.message) ?? asRecord(event.message);
  const messageId = message ? pickString(message, "id") : undefined;
  if (!message || !messageId) {
    return null;
  }

  const kapso = readKapso(message);

  const normalized: IncomingMessage = {
    id: messageId,
    from: pickString(message, "from"),
    to: pickString(message, "to"),
    timestamp: pickString(message, "timestamp"),
    type: asMessageType(pickString(message, "type")),
    direction: kapso.direction ?? "inbound",
    status: kapso.status as IncomingMessage["status"],
    text: extractText(message),
    media: extractMedia(message),
    conversationId: event.conversation?.id,
    phoneNumberId: event.phoneNumberId ?? event.conversation?.phoneNumberId,
    raw: message,
  };

  return {
    message: normalized,
    conversation: normalizeConversation(
      event.raw.conversation ?? event.conversation,
    ),
    isNewConversation: event.isNewConversation,
  };
}

function toConversationPayload(
  conversation: Record<string, unknown>,
): WebhookConversationPayload {
  return {
    id: pickString(conversation, "id") ?? "",
    phoneNumber: pickString(conversation, "phone_number", "phoneNumber"),
    phoneNumberId: pickString(
      conversation,
      "phone_number_id",
      "phoneNumberId",
    ),
    status: pickString(conversation, "status"),
    lastActiveAt: pickString(conversation, "last_active_at", "lastActiveAt"),
    createdAt: pickString(conversation, "created_at", "createdAt"),
    updatedAt: pickString(conversation, "updated_at", "updatedAt"),
    metadata: asRecord(conversation.metadata),
    kapso: asRecord(conversation.kapso) as WebhookConversationPayload["kapso"],
  };
}

export function parseWebhookBody(
  body: Record<string, unknown>,
  headers: WebhookEvent["headers"],
): WebhookEvent {
  const headerEvent = headers.event;
  const bodyType = pickString(body, "type", "event");
  const conversation = asRecord(body.conversation);
  const message = asRecord(body.message);

  return {
    type: headerEvent ?? bodyType ?? "unknown",
    phoneNumberId: pickString(body, "phone_number_id", "phoneNumberId"),
    isNewConversation: pickBoolean(
      body,
      "is_new_conversation",
      "isNewConversation",
    ),
    message: message as WebhookMessagePayload | undefined,
    conversation: conversation
      ? toConversationPayload(conversation)
      : undefined,
    batch: body.batch === true,
    data: Array.isArray(body.data)
      ? body.data.map((item) =>
          parseWebhookBody(asRecord(item) ?? {}, headers),
        )
      : undefined,
    raw: body,
    headers,
  };
}
