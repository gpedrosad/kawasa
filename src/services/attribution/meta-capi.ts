import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ConversionStatus } from "@/types/attribution";
import type { Json } from "@/types/database";

const GRAPH_URL = "https://graph.facebook.com/v21.0";
const MAX_ATTEMPTS = 5;

/** Filas viejas del kanban usaban nombres que Meta no acepta en business_messaging. */
const LEGACY_EVENT_NAMES: Record<string, string> = {
  Lead: "QualifiedLead",
  Subscribe: "Purchase",
};

export function toMetaEventName(eventName: string): string {
  return LEGACY_EVENT_NAMES[eventName] ?? eventName;
}

export interface CapiEventInput {
  eventName: string;
  eventTime: string;
  ctwaClid: string;
  wabaId: string;
  value?: number | null;
  currency?: string | null;
}

/**
 * Evento de Conversions API for Business Messaging (WhatsApp, atribuido por ctwa_clid).
 * Meta no deduplica estos eventos: la unicidad la da conversions.event_id.
 */
export function buildCapiEvent(input: CapiEventInput): Record<string, unknown> {
  const event: Record<string, unknown> = {
    event_name: toMetaEventName(input.eventName),
    event_time: Math.floor(new Date(input.eventTime).getTime() / 1000),
    action_source: "business_messaging",
    messaging_channel: "whatsapp",
    user_data: {
      whatsapp_business_account_id: input.wabaId,
      ctwa_clid: input.ctwaClid,
    },
  };

  if (input.value != null && input.currency) {
    event.custom_data = { currency: input.currency, value: Number(input.value) };
  }

  return event;
}

/**
 * Manda una conversión a Meta y deja el resultado en la fila.
 * Sin token o dataset no hace nada (queda pending). Sin ctwa_clid queda skipped:
 * la persona no vino de un anuncio y no hay a qué atribuirla.
 */
export async function sendConversion(
  conversionId: string,
): Promise<ConversionStatus> {
  const env = getEnv();
  const db = getSupabaseAdmin();

  const { data: conversion, error } = await db
    .from("conversions")
    .select(
      "id, event_name, event_time, value, currency, status, attempts, ad_touch_id",
    )
    .eq("id", conversionId)
    .single();

  if (error) {
    throw error;
  }

  const current = conversion.status as ConversionStatus;
  if (current === "sent" || current === "skipped") {
    return current;
  }

  if (!env.META_CAPI_ACCESS_TOKEN || !env.META_DATASET_ID) {
    logger.info("CAPI sin configurar: la conversión queda pending", {
      conversionId,
    });
    return "pending";
  }

  const { data: touch } = conversion.ad_touch_id
    ? await db
        .from("ad_touches")
        .select("ctwa_clid")
        .eq("id", conversion.ad_touch_id)
        .maybeSingle()
    : { data: null };

  if (!touch?.ctwa_clid) {
    await db
      .from("conversions")
      .update({
        status: "skipped",
        error_message: "Sin ctwa_clid: no vino de un anuncio",
      })
      .eq("id", conversionId);
    return "skipped";
  }

  const body: Record<string, unknown> = {
    data: [
      buildCapiEvent({
        eventName: conversion.event_name,
        eventTime: conversion.event_time,
        ctwaClid: touch.ctwa_clid,
        wabaId: env.META_WABA_ID,
        value: conversion.value,
        currency: conversion.currency,
      }),
    ],
  };
  if (env.META_TEST_EVENT_CODE) {
    body.test_event_code = env.META_TEST_EVENT_CODE;
  }

  let status: ConversionStatus = "failed";
  let metaResponse: Json = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(
      `${GRAPH_URL}/${env.META_DATASET_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const json = (await response.json()) as {
      events_received?: number;
      error?: { message?: string };
    };
    metaResponse = json as Json;

    if (response.ok && (json.events_received ?? 0) > 0) {
      status = "sent";
    } else {
      errorMessage = json.error?.message ?? `HTTP ${response.status}`;
    }
  } catch (fetchError) {
    errorMessage =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
  }

  const { error: updateError } = await db
    .from("conversions")
    .update({
      status,
      meta_response: metaResponse,
      error_message: errorMessage,
      attempts: conversion.attempts + 1,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", conversionId);

  if (updateError) {
    throw updateError;
  }

  logger.info("Conversión enviada a Meta CAPI", {
    conversionId,
    eventName: toMetaEventName(conversion.event_name),
    status,
    error: errorMessage,
  });

  return status;
}

/** Reintenta las pending y failed (cron diario o a mano). */
export async function sendPendingConversions(limit = 50): Promise<{
  processed: number;
  byStatus: Record<string, number>;
}> {
  const { data, error } = await getSupabaseAdmin()
    .from("conversions")
    .select("id")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const byStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    try {
      const status = await sendConversion(row.id);
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    } catch (sendError) {
      byStatus.error = (byStatus.error ?? 0) + 1;
      logger.error("Falló el reintento de conversión", {
        conversionId: row.id,
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }

  return { processed: data?.length ?? 0, byStatus };
}
