#!/usr/bin/env node
/**
 * Copia a KaWa el historial de Kapso (mensajes entrantes y salientes).
 * Completa lo que el webhook no guardó: mensajes viejos, salientes previos al
 * 2026-10-14 o cualquier hueco por caídas. Idempotente por wamid: no pisa
 * mensajes que ya estén en la base.
 *
 *   npm run sync:kapso                      # todo el historial
 *   npm run sync:kapso -- --since=2026-10-01  # conversaciones activas desde esa fecha
 */
import { createClient } from "@supabase/supabase-js";

const KAPSO_BASE = "https://api.kapso.ai/platform/v1";
const {
  KAPSO_API_KEY,
  KAPSO_PHONE_NUMBER_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

for (const [name, value] of Object.entries({
  KAPSO_API_KEY,
  KAPSO_PHONE_NUMBER_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) {
    console.error(`Falta ${name}`);
    process.exit(1);
  }
}

const since = process.argv
  .find((arg) => arg.startsWith("--since="))
  ?.slice("--since=".length);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET a Kapso con pausa entre pedidos y reintento ante 429. */
async function kapsoGet(path) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await sleep(1200);
    const res = await fetch(`${KAPSO_BASE}${path}`, {
      headers: { "X-API-Key": KAPSO_API_KEY },
    });
    if (res.status === 429) {
      await sleep(5000 * attempt);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Kapso ${res.status} en ${path}`);
    }
    return res.json();
  }
  throw new Error(`Kapso 429 persistente en ${path}`);
}

async function* paginate(path) {
  for (let page = 1; ; page += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const body = await kapsoGet(`${path}${sep}per_page=100&page=${page}`);
    yield* body.data ?? [];
    if (!body.meta?.has_next) {
      return;
    }
  }
}

function toIso(timestamp) {
  const n = Number(timestamp);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function toMedia(message) {
  const kapso = message.kapso ?? {};
  const block = message[message.type] ?? {};
  if (!kapso.has_media && !block.id) {
    return null;
  }
  return {
    id: block.id ?? null,
    link: block.link ?? null,
    mime_type: kapso.media_data?.content_type ?? block.mime_type ?? null,
    filename: kapso.media_data?.filename ?? block.filename ?? null,
    caption: block.caption ?? null,
    voice: block.voice ?? null,
    url: kapso.media_url ?? kapso.media_data?.url ?? null,
  };
}

async function upsertContact(phone, name) {
  const { data, error } = await db
    .from("contacts")
    .upsert(
      { phone_number: phone, wa_id: phone, ...(name ? { profile_name: name } : {}) },
      { onConflict: "phone_number" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function syncConversation(conversation) {
  const messages = [];
  for await (const message of paginate(
    `/whatsapp/messages?conversation_id=${conversation.id}`,
  )) {
    messages.push(message);
  }
  if (messages.length === 0) {
    return { inserted: 0, total: 0 };
  }

  const phone = conversation.phone_number ?? messages[0].kapso?.phone_number;
  const name = conversation.kapso?.contact_name ?? conversation.contact_name;
  const contactId = await upsertContact(phone, name);

  const { error: conversationError } = await db.from("conversations").upsert(
    {
      id: conversation.id,
      contact_id: contactId,
      phone_number_id: conversation.phone_number_id,
      status: conversation.status ?? "active",
      last_message_at: conversation.last_active_at ?? null,
      last_inbound_at: conversation.kapso?.last_inbound_at ?? null,
      last_outbound_at: conversation.kapso?.last_outbound_at ?? null,
    },
    { onConflict: "id" },
  );
  if (conversationError) throw conversationError;

  const rows = messages.map((message) => ({
    provider_message_id: message.id,
    conversation_id: conversation.id,
    contact_id: contactId,
    direction: message.kapso?.direction === "outbound" ? "outbound" : "inbound",
    type: message.type ?? "unknown",
    status: message.kapso?.status ?? "received",
    text: message.kapso?.content ?? message.text?.body ?? null,
    media: toMedia(message),
    context_message_id: message.context?.id ?? null,
    occurred_at: toIso(message.timestamp),
    raw: message,
  }));

  const { data, error } = await db
    .from("messages")
    .upsert(rows, { onConflict: "provider_message_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  return { inserted: data?.length ?? 0, total: rows.length };
}

const totals = { conversations: 0, messages: 0, inserted: 0 };

for await (const conversation of paginate(
  `/whatsapp/conversations?phone_number_id=${KAPSO_PHONE_NUMBER_ID}`,
)) {
  if (since && (conversation.last_active_at ?? "") < since) {
    continue;
  }
  const { inserted, total } = await syncConversation(conversation);
  totals.conversations += 1;
  totals.messages += total;
  totals.inserted += inserted;
  if (inserted > 0) {
    console.log(`${conversation.id}: +${inserted}/${total}`);
  }
}

console.log(
  `Listo: ${totals.conversations} conversaciones, ${totals.messages} mensajes en Kapso, ${totals.inserted} nuevos en KaWa.`,
);
