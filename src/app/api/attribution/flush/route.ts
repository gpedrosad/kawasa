import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { sendPendingConversions } from "@/services/attribution/meta-capi";
import { hasBearerSecret } from "@/utils/bearer-secret";
import { handleApiError, UnauthorizedError } from "@/utils/errors";

export const runtime = "nodejs";

/**
 * Reintenta las conversiones pending/failed. Lo llama el cron diario de Vercel
 * (Authorization: Bearer CRON_SECRET) o a mano con KAWA_ATTRIBUTION_SECRET.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const env = getEnv();
    if (
      !hasBearerSecret(request.headers.get("authorization"), [
        process.env.CRON_SECRET,
        env.KAWA_ATTRIBUTION_SECRET,
      ])
    ) {
      throw new UnauthorizedError("Clave inválida");
    }

    const result = await sendPendingConversions();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
