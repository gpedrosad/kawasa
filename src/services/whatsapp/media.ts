import type {
  MediaMetadataResponse,
  MediaUploadResponse,
} from "@kapso/whatsapp-cloud-api";
import { getKapsoClient, getKapsoPhoneNumberId } from "@/lib/kapso";
import { logger } from "@/lib/logger";
import type { DownloadMediaInput, UploadMediaInput } from "@/types/whatsapp";

export async function uploadMedia(
  input: UploadMediaInput,
): Promise<MediaUploadResponse> {
  const phoneNumberId = getKapsoPhoneNumberId();
  const client = getKapsoClient();

  logger.info("Subiendo media WhatsApp", {
    phoneNumberId,
    type: input.type,
    fileName: input.fileName,
  });

  return client.media.upload({
    phoneNumberId,
    type: input.type,
    file: input.file,
    fileName: input.fileName,
  });
}

export async function getMediaMetadata(
  mediaId: string,
): Promise<MediaMetadataResponse> {
  const client = getKapsoClient();
  const phoneNumberId = getKapsoPhoneNumberId();

  return client.media.get({
    mediaId,
    phoneNumberId,
  });
}

export async function downloadMedia(
  input: DownloadMediaInput,
): Promise<ArrayBuffer | Blob | Response> {
  const client = getKapsoClient();
  const phoneNumberId = getKapsoPhoneNumberId();

  logger.info("Descargando media WhatsApp", {
    mediaId: input.mediaId,
    phoneNumberId,
  });

  return client.media.download({
    mediaId: input.mediaId,
    phoneNumberId,
    as: input.as ?? "arrayBuffer",
  });
}
