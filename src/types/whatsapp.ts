import type { AdReferral } from "@/types/attribution";

export type MessageDirection = "inbound" | "outbound";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "template"
  | "reaction"
  | "unknown";

export type MessageStatus =
  | "received"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "pending";

export interface Contact {
  id: string;
  waId?: string;
  phoneNumber: string;
  profileName?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  status?: string;
  contactName?: string;
  lastActiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  messagesCount?: number;
  lastMessageId?: string | null;
  lastMessageType?: string | null;
  lastMessageText?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
}

export interface Media {
  id?: string;
  link?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  sha256?: string;
  fileSize?: number | string;
  voice?: boolean;
  url?: string;
}

export interface IncomingMessage {
  id: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type: MessageType;
  direction: MessageDirection;
  status?: MessageStatus;
  text?: string;
  media?: Media;
  conversationId?: string;
  phoneNumberId?: string;
  /** Referral CTWA si el usuario llegó desde un Meta ad. */
  referral?: AdReferral;
  raw?: Record<string, unknown>;
}

export interface OutgoingMessage {
  to: string;
  type: MessageType;
  text?: string;
  media?: Media;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<Record<string, unknown>>;
  contextMessageId?: string;
}

export type MediaSource =
  | { kind: "link"; link: string }
  | { kind: "id"; id: string };

export interface SendTextInput {
  to: string;
  text: string;
  previewUrl?: boolean;
  contextMessageId?: string;
}

export interface SendAudioInput {
  to: string;
  /** URL pública del audio (LINK). */
  audioUrl?: string;
  /** MEDIA_ID previamente subido. */
  mediaId?: string;
  /** Nota de voz (voice message). Por defecto true en la ruta send-audio. */
  voice?: boolean;
}

export interface TemplateComponentInput {
  type: string;
  [key: string]: unknown;
}

export interface SendTemplateInput {
  to: string;
  name: string;
  language: string;
  components?: TemplateComponentInput[];
}

export interface MarkAsReadInput {
  messageId: string;
  typingIndicator?: boolean;
}

export interface UploadMediaInput {
  file: Blob | File | ArrayBuffer | Uint8Array | Buffer;
  type: string;
  fileName?: string;
}

export interface DownloadMediaInput {
  mediaId: string;
  as?: "arrayBuffer" | "blob" | "response";
}
