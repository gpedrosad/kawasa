import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConversion } from "@/services/attribution/record-conversion";
import { advanceConversationStage } from "@/services/crm/pipeline";
import { hasBearerSecret } from "@/utils/bearer-secret";
import {
  AppError,
  handleApiError,
  UnauthorizedError,
  ValidationError,
} from "@/utils/errors";

export const runtime = "nodejs";

/**
 * AgendApp avisa los escalones que pasan en la web, con el código del link personal:
 * - InitiateCheckout: abrió /suscribirse desde /empezar?wa=<código>
 * - Purchase: pagó la primera cuota
 * Auth: Authorization: Bearer KAWA_ATTRIBUTION_SECRET.
 */
const bodySchema = z.object({
  ref: z.string().regex(/^[a-f0-9]{8}$/),
  event: z.enum(["InitiateCheckout", "Purchase"]),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
});

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
    const { ref, event, value, currency } = parsed.data;

    const db = getSupabaseAdmin();
    const { data: contact, error } = await db
      .from("contacts")
      .select("id")
      .eq("wa_ref", ref)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!contact) {
      throw new AppError("Código de link desconocido", {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }

    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const conversion = await recordConversion({
      eventName: event,
      contactId: contact.id,
      conversationId: conversation?.id,
      eventId: `${contact.id}:${event}`,
      value,
      currency,
      customData: { source: "agendapp" },
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
