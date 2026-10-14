import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  resolveOccurredAt,
  toMediaJson,
} from "@/services/crm/persist-incoming";
import type { Json } from "@/types/database";
import type { Conversation, IncomingMessage } from "@/types/whatsapp";

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

function rank(status: string | undefined): number {
  return status ? (STATUS_RANK[status] ?? -1) : -1;
}

/**
 * Persiste un mensaje saliente (flujo, API o escrito desde la app) en KaWa.
 * Llega por los eventos message.sent / delivered / read / failed: el primero
 * crea la fila y los siguientes solo suben el estado (nunca lo bajan).
 */
export async function persistOutboundMessage(input: {
  message: IncomingMessage;
  conversation?: Conversation;
  eventStatus?: string;
}): Promise<void> {
  const { message, conversation } = input;
  const status =
    rank(input.eventStatus) >= rank(message.status)
      ? input.eventStatus
      : message.status;

  const db = getSupabaseAdmin();

  const { data: existing, error: existingError } = await db
    .from("messages")
    .select("id, status")
    .eq("provider_message_id", message.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    if (status && rank(status) > rank(existing.status)) {
      const { error } = await db
        .from("messages")
        .update({ status })
        .eq("id", existing.id);
      if (error) {
        throw error;
      }
    }
    return;
  }

  const phone = (
    conversation?.phoneNumber ??
    message.contactPhone ??
    message.to
  )?.trim();
  const conversationId = message.conversationId ?? conversation?.id;

  if (!phone || !conversationId) {
    logger.warn("persistOutbound: falta phone o conversationId", {
      messageId: message.id,
      phone,
      conversationId,
    });
    return;
  }

  const occurredAt =
    resolveOccurredAt(message.timestamp) ?? new Date().toISOString();

  // No pisar el nombre del contacto: solo se crea si no existe.
  const { data: found, error: findError } = await db
    .from("contacts")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  let contactId = found?.id;
  if (!contactId) {
    const { data: created, error: createError } = await db
      .from("contacts")
      .upsert(
        {
          phone_number: phone,
          wa_id: phone,
          profile_name: conversation?.contactName ?? message.contactName ?? null,
        },
        { onConflict: "phone_number" },
      )
      .select("id")
      .single();
    if (createError) {
      throw createError;
    }
    contactId = created.id;
  }

  const { error: conversationError } = await db.from("conversations").upsert(
    {
      id: conversationId,
      contact_id: contactId,
      phone_number_id:
        message.phoneNumberId ?? conversation?.phoneNumberId ?? null,
      last_message_at: occurredAt,
      last_outbound_at: occurredAt,
    },
    { onConflict: "id" },
  );

  if (conversationError) {
    throw conversationError;
  }

  const { error: messageError } = await db.from("messages").upsert(
    {
      provider_message_id: message.id,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      type: message.type,
      status: status ?? "sent",
      text: message.text ?? null,
      media: toMediaJson(message.media),
      occurred_at: occurredAt,
      raw: (message.raw as Json | undefined) ?? null,
    },
    { onConflict: "provider_message_id", ignoreDuplicates: true },
  );

  if (messageError) {
    throw messageError;
  }

  logger.info("Mensaje saliente persistido en KaWa", {
    contactId,
    conversationId,
    providerMessageId: message.id,
    origin: message.origin,
  });
}
