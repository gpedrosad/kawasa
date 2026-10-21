import { createHash, randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendConversion } from "@/services/attribution/meta-capi";
import type {
  RecordConversionInput,
  StoredConversion,
} from "@/types/attribution";
import type { Json } from "@/types/database";

const CONVERSION_COLUMNS =
  "id, event_name, event_id, status, conversation_id, ad_touch_id, custom_data";

function defaultEventId(input: RecordConversionInput): string {
  const day = (input.eventTime ? new Date(input.eventTime) : new Date())
    .toISOString()
    .slice(0, 10);
  const basis = [
    input.conversationId ?? input.contactId ?? "anon",
    input.eventName,
    day,
  ].join("|");

  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/**
 * Ad touch de la conversación o, si no hay, el último del contacto: Kapso abre
 * una conversación nueva tras 60 min sin mensajes y el anuncio queda en la primera.
 */
async function findAdTouchId(
  input: RecordConversionInput,
): Promise<string | null> {
  const db = getSupabaseAdmin();

  if (input.conversationId) {
    const { data } = await db
      .from("ad_touches")
      .select("id")
      .eq("conversation_id", input.conversationId)
      .maybeSingle();
    if (data?.id) {
      return data.id;
    }
  }

  if (input.contactId) {
    const { data } = await db
      .from("ad_touches")
      .select("id")
      .eq("contact_id", input.contactId)
      .order("touched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  return null;
}

/**
 * Registra una conversión en KaWa y la manda a Meta CAPI.
 * Idempotente por event_id: si ya existe, no la pisa ni la reenvía.
 */
export async function recordConversion(
  input: RecordConversionInput,
): Promise<StoredConversion> {
  const eventId = input.eventId ?? defaultEventId(input);
  const eventTime = input.eventTime
    ? new Date(input.eventTime).toISOString()
    : new Date().toISOString();
  const adTouchId = await findAdTouchId(input);
  const db = getSupabaseAdmin();

  const { data: inserted, error } = await db
    .from("conversions")
    .upsert(
      {
        contact_id: input.contactId ?? null,
        conversation_id: input.conversationId ?? null,
        ad_touch_id: adTouchId,
        event_name: input.eventName,
        event_id: eventId,
        event_time: eventTime,
        value: input.value ?? null,
        currency: input.currency ?? "USD",
        action_source: input.actionSource ?? "business_messaging",
        status: "pending",
        custom_data: (input.customData as Json | undefined) ?? {},
        user_data: (input.userData as Json | undefined) ?? {
          external_id: input.contactId ?? randomUUID(),
        },
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select(CONVERSION_COLUMNS);

  if (error) {
    throw error;
  }

  const created = Boolean(inserted?.length);
  let data = inserted?.[0];

  if (!data) {
    const { data: existing, error: existingError } = await db
      .from("conversions")
      .select(CONVERSION_COLUMNS)
      .eq("event_id", eventId)
      .single();
    if (existingError) {
      throw existingError;
    }
    data = existing;
  }

  let status = data.status as StoredConversion["status"];
  if (created) {
    try {
      status = await sendConversion(data.id);
    } catch (sendError) {
      // Queda pending: el cron diario la reintenta.
      logger.error("Falló el envío a Meta CAPI", {
        conversionId: data.id,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }

  logger.info("Conversión registrada", {
    conversionId: data.id,
    eventName: data.event_name,
    eventId: data.event_id,
    created,
    status,
    conversationId: data.conversation_id,
    adTouchId: data.ad_touch_id,
  });

  return {
    id: data.id,
    created,
    eventName: data.event_name,
    eventId: data.event_id,
    status,
    conversationId: data.conversation_id,
    adTouchId: data.ad_touch_id,
    customData: data.custom_data,
  };
}
