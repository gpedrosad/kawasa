import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendText } from "@/services/whatsapp";
import { handleApiError, ValidationError } from "@/utils/errors";
import { isValidInternationalPhone } from "@/utils/phone";

export const runtime = "nodejs";

const bodySchema = z.object({
  to: z
    .string()
    .min(1, "to es requerido")
    .refine(isValidInternationalPhone, {
      message: "to debe ser un número internacional válido (E.164)",
    }),
  text: z.string().min(1, "text es requerido"),
  previewUrl: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new ValidationError("Payload inválido", parsed.error.issues);
    }

    const result = await sendText({
      to: parsed.data.to,
      text: parsed.data.text,
      previewUrl: parsed.data.previewUrl,
    });

    logger.info("Texto enviado", {
      messageId: result.messages[0]?.id,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
