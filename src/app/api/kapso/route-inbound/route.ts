import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";
import { assignOpeningMessage } from "@/services/routing/opening-variants";
import { decideRoute, loadRouteFacts } from "@/services/routing/route-inbound";
import { hasBearerSecret } from "@/utils/bearer-secret";
import { handleApiError, UnauthorizedError, ValidationError } from "@/utils/errors";

export const runtime = "nodejs";

/**
 * La Kapso Function del flujo «Ventas desde anuncio (agente)» pregunta quién contesta
 * un mensaje entrante. Responde `{ route: "agente" | "saludo" | "silencio", reason }`;
 * con «saludo» suma `variant` y `message`: el primer mensaje fijo del A/B que manda Kapso.
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

    if (decision.route === "saludo") {
      const opening = facts.phoneNumber ? await assignOpeningMessage(facts.phoneNumber) : null;
      if (!opening) {
        // Otro mensaje entró a la vez y ya tiene su primer mensaje: que siga el agente.
        logger.info("Ruta de mensaje entrante", { route: "agente", reason: "primer mensaje ya asignado" });
        return NextResponse.json({ route: "agente", reason: "primer mensaje ya asignado" });
      }
      logger.info("Ruta de mensaje entrante", { ...decision, variant: opening.variant });
      return NextResponse.json({ ...decision, ...opening });
    }

    logger.info("Ruta de mensaje entrante", { route: decision.route, reason: decision.reason });
    return NextResponse.json(decision);
  } catch (error) {
    return handleApiError(error);
  }
}
