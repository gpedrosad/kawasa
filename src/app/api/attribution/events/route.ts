import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConversion } from "@/services/attribution/record-conversion";
import { advanceConversationStage } from "@/services/crm/pipeline";
import { hasBearerSecret } from "@/utils/bearer-secret";
import { argentinePhoneCandidates } from "@/utils/phone";
import {
  AppError,
  handleApiError,
  UnauthorizedError,
  ValidationError,
} from "@/utils/errors";

export const runtime = "nodejs";

/**
 * AgendApp avisa los escalones que pasan en la web. Identifica a la persona por el
 * código del link personal (`ref`) o por el WhatsApp que puso en /suscribirse (`phone`),
 * cuando llegó por el link genérico /empezar:
 * - InitiateCheckout: abrió /suscribirse desde /empezar?wa=<código>, o mandó el formulario
 * - Purchase: pagó la primera cuota
 * Por teléfono solo cuenta si el contacto escribió desde un anuncio (si no, 404).
 * Auth: Authorization: Bearer KAWA_ATTRIBUTION_SECRET.
 */
const bodySchema = z
  .object({
    ref: z.string().regex(/^[a-f0-9]{8}$/).optional(),
    phone: z.string().min(8).max(20).optional(),
    event: z.enum(["InitiateCheckout", "Purchase"]),
    value: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
  })
  .refine((body) => body.ref || body.phone, { message: "Falta ref o phone" });

async function findContactId(ref: string | undefined, phone: string | undefined) {
  const db = getSupabaseAdmin();

  if (ref) {
    const { data, error } = await db
      .from("contacts")
      .select("id")
      .eq("wa_ref", ref)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data?.id ?? null;
  }

  const candidates = argentinePhoneCandidates(phone ?? "");
  if (candidates.length === 0) {
    return null;
  }
  const { data: contacts, error } = await db
    .from("contacts")
    .select("id")
    .in("phone_number", candidates);
  if (error) {
    throw error;
  }
  const ids = (contacts ?? []).map((contact) => contact.id);
  if (ids.length === 0) {
    return null;
  }

  // Un teléfono cualquiera no alcanza: tiene que haber escrito desde un anuncio.
  const { data: touch, error: touchError } = await db
    .from("ad_touches")
    .select("contact_id")
    .in("contact_id", ids)
    .not("ctwa_clid", "is", null)
    .order("touched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (touchError) {
    throw touchError;
  }
  return touch?.contact_id ?? null;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const env = getEnv();
    if (
      !hasBearerSecret(request.headers.get("authorization"), [
        env.KAWA_ATTRIBUTION_SECRET,
      ])
    ) {
      throw new UnauthorizedError("Clave de atribución inválida");
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("Payload inválido", parsed.error.issues);
    }
    const { ref, phone, event, value, currency } = parsed.data;

    const contactId = await findContactId(ref, phone);
    if (!contactId) {
      throw new AppError(
        ref ? "Código de link desconocido" : "Teléfono sin contacto de anuncio",
        { statusCode: 404, code: "NOT_FOUND" },
      );
    }

    const db = getSupabaseAdmin();

    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const conversion = await recordConversion({
      eventName: event,
      contactId,
      conversationId: conversation?.id,
      eventId: `${contactId}:${event}`,
      value,
      currency,
      customData: { source: "agendapp", matched_by: ref ? "wa_ref" : "phone" },
    });

    if (event === "Purchase" && conversation?.id) {
      await advanceConversationStage({
        conversationId: conversation.id,
        stage: "ganado",
      });
    }

    return NextResponse.json({
      ok: true,
      data: { created: conversion.created, status: conversion.status },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
