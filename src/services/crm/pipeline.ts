import {
  getPipelineStage,
  isPipelineStageId,
  type PipelineStageId,
} from "@/config/pipeline";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConversion } from "@/services/attribution/record-conversion";

export interface CrmConversationCard {
  id: string;
  stage: PipelineStageId;
  status: string;
  phoneNumber: string | null;
  contactName: string | null;
  contactId: string;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  hasAdTouch: boolean;
}

type ConversationListRow = {
  id: string;
  stage: string;
  status: string;
  contact_id: string;
  last_message_at: string | null;
  contacts:
    | { phone_number: string; profile_name: string | null }
    | { phone_number: string; profile_name: string | null }[]
    | null;
};

export async function listCrmConversations(): Promise<CrmConversationCard[]> {
  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from("conversations")
    .select(
      `
      id,
      stage,
      status,
      contact_id,
      last_message_at,
      contacts (
        phone_number,
        profile_name
      )
    `,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as ConversationListRow[];
  const conversationIds = rows.map((row) => row.id);

  const { data: adTouches } = conversationIds.length
    ? await db
        .from("ad_touches")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
    : { data: [] as Array<{ conversation_id: string | null }> };

  const touchSet = new Set(
    (adTouches ?? [])
      .map((touch) => touch.conversation_id)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const stage = isPipelineStageId(row.stage) ? row.stage : "nuevo";

    return {
      id: row.id,
      stage,
      status: row.status,
      contactId: row.contact_id,
      phoneNumber: contact?.phone_number ?? null,
      contactName: contact?.profile_name ?? null,
      lastMessageAt: row.last_message_at,
      lastMessageText: null,
      hasAdTouch: touchSet.has(row.id),
    };
  });
}

export async function moveConversationStage(input: {
  conversationId: string;
  stage: PipelineStageId;
}): Promise<{
  conversation: CrmConversationCard;
  conversionRecorded: boolean;
  conversionEvent: string | null;
}> {
  const stageConfig = getPipelineStage(input.stage);
  const db = getSupabaseAdmin();

  const { data: updated, error } = await db
    .from("conversations")
    .update({ stage: input.stage })
    .eq("id", input.conversationId)
    .select(
      `
      id,
      stage,
      status,
      contact_id,
      last_message_at,
      contacts (
        phone_number,
        profile_name
      )
    `,
    )
    .single();

  if (error) {
    throw error;
  }

  const row = updated as unknown as ConversationListRow;

  let conversionRecorded = false;
  if (stageConfig.conversionEvent) {
    await recordConversion({
      eventName: stageConfig.conversionEvent,
      conversationId: row.id,
      contactId: row.contact_id,
      eventId: `${row.id}:${stageConfig.conversionEvent}`,
      customData: {
        pipeline_stage: input.stage,
        source: "crm_kanban",
      },
    });
    conversionRecorded = true;
  }

  logger.info("Conversación movida en funnel", {
    conversationId: input.conversationId,
    stage: input.stage,
    conversionRecorded,
    conversionEvent: stageConfig.conversionEvent,
  });

  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

  return {
    conversation: {
      id: row.id,
      stage: input.stage,
      status: row.status,
      contactId: row.contact_id,
      phoneNumber: contact?.phone_number ?? null,
      contactName: contact?.profile_name ?? null,
      lastMessageAt: row.last_message_at,
      lastMessageText: null,
      hasAdTouch: false,
    },
    conversionRecorded,
    conversionEvent: stageConfig.conversionEvent,
  };
}
