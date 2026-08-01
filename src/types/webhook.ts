import type { Conversation, IncomingMessage } from "@/types/whatsapp";

/**
 * Eventos Kapso v2 (oficiales) y alias cortos del dominio.
 */
export type WebhookEventType =
  | "whatsapp.message.received"
  | "whatsapp.message.sent"
  | "whatsapp.message.delivered"
  | "whatsapp.message.read"
  | "whatsapp.message.failed"
  | "whatsapp.conversation.created"
  | "whatsapp.conversation.ended"
  | "whatsapp.conversation.inactive"
  | "whatsapp.conversation.updated"
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "conversation.created"
  | "conversation.ended"
  | "conversation.inactive"
  | "conversation.updated"
  | string;

export interface WebhookMessageKapso {
  direction?: "inbound" | "outbound";
  status?: string;
  processingStatus?: string;
  origin?: string;
  hasMedia?: boolean;
  content?: string;
  transcript?: { text?: string };
  mediaUrl?: string;
  mediaData?: {
    url?: string;
    filename?: string;
    contentType?: string;
    byteSize?: number;
  };
  statuses?: Array<Record<string, unknown>>;
}

export interface WebhookMessagePayload {
  id: string;
  timestamp?: string;
  type?: string;
  from?: string;
  to?: string;
  text?: { body?: string };
  audio?: { id?: string; link?: string; voice?: boolean };
  image?: { id?: string; link?: string; caption?: string };
  video?: { id?: string; link?: string; caption?: string };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  kapso?: WebhookMessageKapso;
  [key: string]: unknown;
}

export interface WebhookConversationPayload {
  id: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  status?: string;
  lastActiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  kapso?: {
    contactName?: string;
    messagesCount?: number;
    lastMessageId?: string | null;
    lastMessageType?: string | null;
    lastMessageTimestamp?: string | null;
    lastMessageText?: string | null;
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
  };
  [key: string]: unknown;
}

export interface WebhookEvent {
  type: WebhookEventType;
  phoneNumberId?: string;
  isNewConversation?: boolean;
  message?: WebhookMessagePayload;
  conversation?: WebhookConversationPayload;
  /** Envelope batch (message buffering). */
  batch?: boolean;
  data?: WebhookEvent[];
  raw: Record<string, unknown>;
  headers: {
    event?: string;
    signature?: string;
    idempotencyKey?: string;
    payloadVersion?: string;
  };
}

export interface NormalizedIncomingPayload {
  message: IncomingMessage;
  conversation?: Conversation;
  isNewConversation?: boolean;
}
