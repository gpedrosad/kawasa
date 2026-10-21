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

/**
 * Eventos que acepta Meta para business_messaging (WhatsApp). `Lead` y `Subscribe`
 * no existen ahí: quedan solo por filas viejas y se mandan como QualifiedLead / Purchase.
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging
 */
export type ConversionEventName =
  | "QualifiedLead"
  | "InitiateCheckout"
  | "Purchase"
  | "LeadSubmitted"
  | "ViewContent"
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
  /** false si ya existía una conversión con el mismo event_id. */
  created: boolean;
  eventName: string;
  eventId: string;
  status: ConversionStatus;
  conversationId?: string | null;
  adTouchId?: string | null;
  customData?: Json;
}
