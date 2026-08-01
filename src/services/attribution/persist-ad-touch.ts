import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AdReferral } from "@/types/attribution";
import type { Json } from "@/types/database";

/**
 * Guarda first-touch de ad (CTWA). Idempotente por conversation_id.
 */
export async function persistAdTouch(input: {
  referral: AdReferral;
  contactId: string;
  conversationId: string;
  messageId?: string;
  touchedAt?: string | null;
}): Promise<string | null> {
  const { referral } = input;
  const db = getSupabaseAdmin();

  const { error } = await db.from("ad_touches").upsert(
    {
      contact_id: input.contactId,
      conversation_id: input.conversationId,
      message_id: input.messageId ?? null,
      source: "meta",
      channel: "ctwa",
      ctwa_clid: referral.ctwaClid ?? null,
      source_id: referral.sourceId ?? null,
      source_type: referral.sourceType ?? null,
      source_url: referral.sourceUrl ?? null,
      headline: referral.headline ?? null,
      body: referral.body ?? null,
      media_type: referral.mediaType ?? null,
      campaign_id: referral.campaignId ?? null,
      adset_id: referral.adsetId ?? null,
      ad_id: referral.adId ?? null,
      utm: (referral.utm as Json | undefined) ?? {},
      raw: (referral.raw as Json | undefined) ?? null,
      touched_at: input.touchedAt ?? new Date().toISOString(),
    },
    { onConflict: "conversation_id", ignoreDuplicates: true },
  );

  if (error) {
    throw error;
  }

  const { data, error: selectError } = await db
    .from("ad_touches")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (data?.id) {
    logger.info("Ad touch CTWA listo", {
      adTouchId: data.id,
      conversationId: input.conversationId,
      ctwaClid: referral.ctwaClid,
      campaignId: referral.campaignId,
    });
  }

  return data?.id ?? null;
}
