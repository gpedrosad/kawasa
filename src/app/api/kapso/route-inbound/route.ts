import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";
import { decideRoute, loadRouteFacts } from "@/services/routing/route-inbound";
import { hasBearerSecret } from "@/utils/bearer-secret";
import { handleApiError, UnauthorizedError, ValidationError } from "@/utils/errors";

export const runtime = "nodejs";

/**
 * La Kapso Function del flujo «Ventas desde anuncio (agente)» pregunta quién contesta
 * un mensaje entrante. Responde `{ route: "agente" | "silencio", reason }`.
 * Auth: Authorization: Bearer KAPSO_ROUTER_SECRET. Sin PII en la respuesta.
 */
const bodySchema = z.object({
  phone: z.string().min(8).max(20),
  text: z.string().max(4000).nullish(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const env = getEnv();
    if (!hasBearerSecret(request.headers.get("authorization"), [env.KAPSO_ROUTER_SECRET])) {
      throw new UnauthorizedError("Clave del router inválida");
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("Payload inválido", parsed.error.issues);
    }

    const facts = await loadRouteFacts(parsed.data);
    const decision = decideRoute(facts);
    logger.info("Ruta de mensaje entrante", { route: decision.route, reason: decision.reason });

    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
