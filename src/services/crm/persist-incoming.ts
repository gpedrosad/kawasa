import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import { persistAdTouch } from "@/services/attribution/persist-ad-touch";
import type { Json } from "@/types/database";
import type { Conversation, IncomingMessage, Media } from "@/types/whatsapp";

function toMediaJson(media: Media | undefined): Json | null {
  if (!media) {
    return null;
  }

  return {
    id: media.id ?? null,
    link: media.link ?? null,
    mime_type: media.mimeType ?? null,
    filename: media.filename ?? null,
    caption: media.caption ?? null,
    voice: media.voice ?? null,
    url: media.url ?? null,
  };
}

function resolveOccurredAt(timestamp: string | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const asNumber = Number(timestamp);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const ms = asNumber < 1e12 ? asNumber * 1000 : asNumber;
    return new Date(ms).toISOString();
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * Persiste contacto + conversación + mensaje entrante en KaWa (3 tablas).
 * Idempotente por provider_message_id (wamid).
 */
export async function persistIncomingMessage(input: {
  message: IncomingMessage;
  conversation?: Conversation;
  profileName?: string;
}): Promise<{ contactId: string; conversationId: string; messageId: string } | null> {
  const { message, conversation } = input;
  const phone = message.from?.trim();
  const conversationId = message.conversationId ?? conversation?.id;

  if (!phone || !conversationId) {
    logger.warn("persistIncoming: falta phone o conversationId", {
      messageId: message.id,
      phone,
      conversationId,
    });
    return null;
  }

  const db = getSupabaseAdmin();
  const occurredAt = resolveOccurredAt(message.timestamp);

  const { data: contact, error: contactError } = await db
    .from("contacts")
    .upsert(
      {
        phone_number: phone,
        wa_id: phone,
        profile_name: input.profileName ?? conversation?.contactName ?? null,
      },
      { onConflict: "phone_number" },
    )
    .select("id")
    .single();

  if (contactError) {
    throw contactError;
  }

  const { error: conversationError } = await db.from("conversations").upsert(
    {
      id: conversationId,
      contact_id: contact.id,
      phone_number_id:
        message.phoneNumberId ?? conversation?.phoneNumberId ?? null,
      status: conversation?.status ?? "active",
      last_message_at: occurredAt ?? new Date().toISOString(),
      last_inbound_at: occurredAt ?? new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (conversationError) {
    throw conversationError;
  }

  const { data: savedMessage, error: messageError } = await db
    .from("messages")
    .upsert(
      {
        provider_message_id: message.id,
        conversation_id: conversationId,
        contact_id: contact.id,
        direction: "inbound",
        type: message.type,
        status: message.status ?? "received",
        text: message.text ?? null,
        media: toMediaJson(message.media),
        occurred_at: occurredAt,
        raw: (message.raw as Json | undefined) ?? null,
      },
      { onConflict: "provider_message_id" },
    )
    .select("id")
    .single();

  if (messageError) {
    throw messageError;
  }

  if (message.referral) {
    try {
      await persistAdTouch({
        referral: message.referral,
        contactId: contact.id,
        conversationId,
        messageId: savedMessage.id,
        touchedAt: occurredAt,
      });
    } catch (error) {
      logger.warn("No se pudo persistir ad touch CTWA", {
        conversationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Mensaje entrante persistido en KaWa", {
    contactId: contact.id,
    conversationId,
    messageId: savedMessage.id,
    providerMessageId: message.id,
    hasReferral: Boolean(message.referral),
  });

  return {
    contactId: contact.id,
    conversationId,
    messageId: savedMessage.id,
  };
}
