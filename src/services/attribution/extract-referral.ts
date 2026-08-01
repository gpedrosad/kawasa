import type { AdReferral } from "@/types/attribution";
import { asRecord, pickString } from "@/utils/object";

function parseUtmFromUrl(url: string | undefined): Record<string, string> {
  if (!url) {
    return {};
  }

  try {
    const parsed = new URL(url);
    const utm: Record<string, string> = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      if (key.startsWith("utm_") && value) {
        utm[key] = value;
      }
    }
    return utm;
  } catch {
    return {};
  }
}

/**
 * Extrae referral CTWA del mensaje WhatsApp/Kapso (si el usuario llegó desde un ad).
 */
export function extractAdReferral(
  messageRaw: Record<string, unknown> | undefined,
): AdReferral | null {
  if (!messageRaw) {
    return null;
  }

  const referral =
    asRecord(messageRaw.referral) ??
    asRecord(asRecord(messageRaw.kapso)?.referral);

  if (!referral) {
    return null;
  }

  const sourceUrl = pickString(referral, "source_url", "sourceUrl");
  const ctwaClid = pickString(referral, "ctwa_clid", "ctwaClid");
  const sourceId = pickString(referral, "source_id", "sourceId");
  const sourceType = pickString(referral, "source_type", "sourceType");

  if (!ctwaClid && !sourceUrl && !sourceId && !sourceType) {
    return null;
  }

  return {
    sourceUrl,
    sourceType,
    sourceId,
    headline: pickString(referral, "headline"),
    body: pickString(referral, "body"),
    mediaType: pickString(referral, "media_type", "mediaType"),
    imageUrl: pickString(referral, "image_url", "imageUrl"),
    ctwaClid,
    campaignId: pickString(referral, "campaign_id", "campaignId"),
    adsetId: pickString(
      referral,
      "adset_id",
      "adSetId",
      "adsetId",
      "adgroup_id",
      "adgroupId",
    ),
    adId: pickString(referral, "ad_id", "adId"),
    utm: parseUtmFromUrl(sourceUrl),
    raw: referral,
  };
}
