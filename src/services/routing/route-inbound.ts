import { getEnv } from "@/config/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { argentinePhoneCandidates } from "@/utils/phone";

/**
 * Quién contesta un mensaje entrante al número de ventas: el agente de IA de Kapso
 * («Ventas desde anuncio (agente)») o nadie (lo ve Gonzalo). La Kapso Function del
 * paso «¿Contesta el agente?» llama a POST /api/kapso/route-inbound con esto.
 * Si todavía no le escribimos nada, la ruta es «saludo»: Kapso manda el primer mensaje
 * fijo del A/B (opening-variants.ts) y después sigue el agente.
 *
 * Contesta el agente solo si la persona escribió desde un anuncio hace poco y la charla
 * no la tomó Gonzalo. Clientes, pacientes y soporte comparten el número: ante la duda,
 * silencio.
 */

export type InboundRoute = "agente" | "saludo" | "silencio";

/** Solo leads de anuncios desde que se prendió el agente: los anteriores los sigue Gonzalo. */
export const AGENT_LIVE_SINCE = "2026-10-22T00:00:00-03:00";
/** Ventana de atribución de Meta para Click-to-WhatsApp. */
const AD_WINDOW_DAYS = 14;
/** Después de pasarle la charla a Gonzalo, el agente no vuelve a hablar por este tiempo. */
const HANDOFF_QUIET_DAYS = 7;
/** Mensaje precargado del anuncio: cubre el primer mensaje si KaWa todavía no lo guardó. */
const PRELOADED_AD_MESSAGE = /vi el anuncio/i;
/** Etapas del CRM en las que el agente no habla (Gonzalo las mueve en el kanban). */
const SILENT_STAGES = new Set(["ganado", "perdido"]);

const DAY_MS = 24 * 60 * 60 * 1000;
const KAPSO_PLATFORM_URL = "https://api.kapso.ai/platform/v1";

export type RouteFacts = {
  contactFound: boolean;
  lastAdTouchAt: string | null;
  stage: string | null;
  lastHandoffAt: string | null;
  text: string | null;
  /** Ya le mandamos algo (mensaje guardado en KaWa o primer mensaje del A/B asignado). */
  alreadyAnswered: boolean;
  /** Teléfono como está en contacts.phone_number (54 + 10 dígitos). */
  phoneNumber: string | null;
};

export function decideRoute(
  facts: RouteFacts,
  now = new Date(),
): { route: InboundRoute; reason: string } {
  const preloaded = PRELOADED_AD_MESSAGE.test(facts.text ?? "");

  if (facts.lastHandoffAt && now.getTime() - Date.parse(facts.lastHandoffAt) < HANDOFF_QUIET_DAYS * DAY_MS) {
    return { route: "silencio", reason: "la charla la tiene Gonzalo" };
  }
  if (facts.stage && SILENT_STAGES.has(facts.stage)) {
    return { route: "silencio", reason: `etapa ${facts.stage}` };
  }

  const touchedAt = facts.lastAdTouchAt ? Date.parse(facts.lastAdTouchAt) : null;
  const recentTouch =
    touchedAt !== null &&
    touchedAt >= Date.parse(AGENT_LIVE_SINCE) &&
    now.getTime() - touchedAt < AD_WINDOW_DAYS * DAY_MS;

  if (recentTouch) {
    return facts.alreadyAnswered
      ? { route: "agente", reason: "escribió desde un anuncio" }
      : { route: "saludo", reason: "escribió desde un anuncio, primer mensaje" };
  }
  // Primer mensaje de alguien nuevo: el anuncio todavía puede no estar guardado.
  if (preloaded && !facts.lastAdTouchAt) {
    return facts.alreadyAnswered
      ? { route: "agente", reason: "mensaje precargado del anuncio" }
      : { route: "saludo", reason: "mensaje precargado del anuncio, primer mensaje" };
  }
  return { route: "silencio", reason: facts.contactFound ? "no viene de un anuncio reciente" : "contacto desconocido" };
}

async function findLastHandoffAt(conversationIds: string[]): Promise<string | null> {
  const apiKey = getEnv().KAPSO_API_KEY;
  let latest: string | null = null;

  for (const conversationId of conversationIds) {
    const response = await fetch(
      `${KAPSO_PLATFORM_URL}/whatsapp/conversations/${conversationId}/flow_executions`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) {
      throw new Error(`Kapso flow_executions respondió ${response.status}`);
    }
    const payload = (await response.json()) as {
      data?: Array<{ status?: string; last_event_at?: string | null; started_at?: string }>;
    };
    for (const execution of payload.data ?? []) {
      const at = execution.last_event_at ?? execution.started_at ?? null;
      if (execution.status === "handoff" && at && (!latest || Date.parse(at) > Date.parse(latest))) {
        latest = at;
      }
    }
  }

  return latest;
}

export async function loadRouteFacts(input: {
  phone: string;
  text?: string | null;
}): Promise<RouteFacts> {
  const db = getSupabaseAdmin();
  const candidates = argentinePhoneCandidates(input.phone);
  const empty: RouteFacts = {
    contactFound: false,
    lastAdTouchAt: null,
    stage: null,
    lastHandoffAt: null,
    text: input.text ?? null,
    alreadyAnswered: false,
    phoneNumber: candidates[0] ?? null,
  };
  if (candidates.length === 0) {
    return empty;
  }

  const [{ data: contact, error }, { data: opening, error: openingError }] = await Promise.all([
    db.from("contacts").select("id, phone_number").in("phone_number", candidates).limit(1).maybeSingle(),
    db.from("opening_messages").select("id").in("phone_number", candidates).limit(1).maybeSingle(),
  ]);
  if (error) {
    throw error;
  }
  if (openingError) {
    throw openingError;
  }
  if (!contact) {
    return { ...empty, alreadyAnswered: Boolean(opening) };
  }

  const [
    { data: touch, error: touchError },
    { data: conversations, error: conversationsError },
    { data: outbound, error: outboundError },
  ] = await Promise.all([
      db
        .from("ad_touches")
        .select("touched_at")
        .eq("contact_id", contact.id)
        .not("ctwa_clid", "is", null)
        .order("touched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("conversations")
        .select("id, stage, last_message_at")
        .eq("contact_id", contact.id)
        .gte("last_message_at", new Date(Date.now() - HANDOFF_QUIET_DAYS * DAY_MS).toISOString())
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(5),
      db
        .from("messages")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("direction", "outbound")
        .limit(1)
        .maybeSingle(),
    ]);
  if (touchError) {
    throw touchError;
  }
  if (conversationsError) {
    throw conversationsError;
  }
  if (outboundError) {
    throw outboundError;
  }

  return {
    contactFound: true,
    lastAdTouchAt: touch?.touched_at ?? null,
    // Una charla marcada ganado o perdido frena al agente aunque Kapso abra otra conversación.
    stage:
      conversations?.find((row) => SILENT_STAGES.has(row.stage))?.stage ??
      conversations?.[0]?.stage ??
      null,
    lastHandoffAt: await findLastHandoffAt((conversations ?? []).map((row) => row.id)),
    text: input.text ?? null,
    alreadyAnswered: Boolean(opening || outbound),
    phoneNumber: contact.phone_number,
  };
}
