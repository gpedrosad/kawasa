import { createHash, randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  RecordConversionInput,
  StoredConversion,
} from "@/types/attribution";
import type { Json } from "@/types/database";

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
 * Registra una conversión en KaWa (status=pending).
 * No envía a Meta CAPI todavía — deja el evento listo para pulir targeting luego.
 */
export async function recordConversion(
  input: RecordConversionInput,
): Promise<StoredConversion> {
  const eventId = input.eventId ?? defaultEventId(input);
  const eventTime = input.eventTime
    ? new Date(input.eventTime).toISOString()
    : new Date().toISOString();

  let adTouchId: string | null = null;
  if (input.conversationId) {
    const { data: touch } = await getSupabaseAdmin()
      .from("ad_touches")
      .select("id")
      .eq("conversation_id", input.conversationId)
      .maybeSingle();
    adTouchId = touch?.id ?? null;
  }

  const { data, error } = await getSupabaseAdmin()
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
      { onConflict: "event_id" },
    )
    .select("id, event_name, event_id, status, conversation_id, ad_touch_id, custom_data")
    .single();

  if (error) {
    throw error;
  }

  logger.info("Conversión registrada (pending CAPI)", {
    conversionId: data.id,
    eventName: data.event_name,
    eventId: data.event_id,
    conversationId: data.conversation_id,
    adTouchId: data.ad_touch_id,
  });

  return {
    id: data.id,
    eventName: data.event_name,
    eventId: data.event_id,
    status: data.status as StoredConversion["status"],
    conversationId: data.conversation_id,
    adTouchId: data.ad_touch_id,
    customData: data.custom_data,
  };
}
