import { NextResponse } from "next/server";
import { z } from "zod";
import { isPipelineStageId } from "@/config/pipeline";
import { moveConversationStage } from "@/services/crm/pipeline";
import { handleApiError, ValidationError } from "@/utils/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  stage: z.string().refine(isPipelineStageId, {
    message: "Etapa de pipeline inválida",
  }),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new ValidationError("Payload inválido", parsed.error.issues);
    }

    if (!id) {
      throw new ValidationError("conversation id requerido");
    }

    const result = await moveConversationStage({
      conversationId: id,
      stage: parsed.data.stage,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
