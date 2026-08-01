import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";
import { handleWebhook } from "@/services/webhooks/handle-webhook";
import {
  handleApiError,
  UnauthorizedError,
  ValidationError,
} from "@/utils/errors";
import { asRecord } from "@/utils/object";
import { verifyKapsoWebhookSignature } from "@/utils/webhook-signature";

export const runtime = "nodejs";

/**
 * Webhook Kapso (Coexistence / Cloud API).
 * Verifica HMAC SHA256 con X-Webhook-Signature sobre el raw body.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature");
    const { KAPSO_WEBHOOK_SECRET } = getEnv();

    const isValid = verifyKapsoWebhookSignature(
      rawBody,
      signature,
      KAPSO_WEBHOOK_SECRET,
    );

    if (!isValid) {
      logger.warn("Firma de webhook Kapso inválida");
      throw new UnauthorizedError("Firma de webhook inválida");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ValidationError("JSON de webhook inválido");
    }

    const body = asRecord(parsed);
    if (!body) {
      throw new ValidationError("Payload de webhook inválido");
    }

    await handleWebhook(body, {
      event: request.headers.get("x-webhook-event") ?? undefined,
      signature: signature ?? undefined,
      idempotencyKey:
        request.headers.get("x-idempotency-key") ?? undefined,
      payloadVersion:
        request.headers.get("x-webhook-payload-version") ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
