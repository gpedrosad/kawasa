import type { Json } from "@/types/database";

/**
 * Referral CTWA de WhatsApp (Click-to-WhatsApp ads).
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */
export interface AdReferral {
  sourceUrl?: string;
  sourceType?: string;
  sourceId?: string;
  headline?: string;
  body?: string;
  mediaType?: string;
  imageUrl?: string;
  ctwaClid?: string;
  /** IDs de campaña si vienen en el payload o se enriquecen después. */
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  utm?: Record<string, string>;
  raw?: Record<string, unknown>;
}

export type ConversionEventName =
  | "Lead"
  | "Purchase"
  | "CompleteRegistration"
  | "Schedule"
  | "Contact"
  | "SubmitApplication"
  | "StartTrial"
  | "Subscribe"
  | (string & {});

export type ConversionStatus = "pending" | "sent" | "failed" | "skipped";

export interface RecordConversionInput {
  eventName: ConversionEventName;
  /** Idempotencia Meta; si no se pasa se genera estable por conversación+evento+día. */
  eventId?: string;
  eventTime?: Date | string;
  contactId?: string;
  conversationId?: string;
  value?: number;
  currency?: string;
  /** Default: business_messaging (WhatsApp / CTWA). */
  actionSource?: string;
  customData?: Record<string, unknown>;
  userData?: Record<string, unknown>;
}

export interface StoredConversion {
  id: string;
  eventName: string;
  eventId: string;
  status: ConversionStatus;
  conversationId?: string | null;
  adTouchId?: string | null;
  customData?: Json;
}
