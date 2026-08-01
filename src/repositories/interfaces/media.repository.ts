import type { Media } from "@/types/whatsapp";

/**
 * Puerto de persistencia/metadatos de media.
 * En KaWa el media vive inline en `messages.media` (jsonb); no hay tabla aparte.
 */
export interface MediaRepository {
  findById(id: string): Promise<Media | null>;
  save(media: Media): Promise<Media>;
  delete(id: string): Promise<void>;
}
