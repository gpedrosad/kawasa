import { NextResponse } from "next/server";
import { listCrmConversations } from "@/services/crm/pipeline";
import { handleApiError } from "@/utils/errors";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const conversations = await listCrmConversations();
    return NextResponse.json({ ok: true, data: conversations });
  } catch (error) {
    return handleApiError(error);
  }
}
