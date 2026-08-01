import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sendAudio } from "@/services/whatsapp";
import { handleApiError, ValidationError } from "@/utils/errors";
import { isValidInternationalPhone } from "@/utils/phone";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    telefono: z
      .string()
      .min(1, "telefono es requerido")
      .refine(isValidInternationalPhone, {
        message: "telefono debe ser un número internacional válido (E.164)",
      }),
    audioUrl: z.string().url("audioUrl debe ser una URL válida").optional(),
    mediaId: z.string().min(1).optional(),
    voice: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.audioUrl || value.mediaId), {
    message: "Debes enviar audioUrl (LINK) o mediaId (MEDIA_ID)",
    path: ["audioUrl"],
  });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new ValidationError("Payload inválido", parsed.error.issues);
    }

    const result = await sendAudio({
      to: parsed.data.telefono,
      audioUrl: parsed.data.audioUrl,
      mediaId: parsed.data.mediaId,
      voice: parsed.data.voice,
    });

    logger.info("Audio enviado", {
      messageId: result.messages[0]?.id,
      voice: parsed.data.voice,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
