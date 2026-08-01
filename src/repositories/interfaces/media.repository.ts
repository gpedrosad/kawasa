import type { Media } from "@/types/whatsapp";

/**
 * Puerto de persistencia/metadatos de media.
 */
export interface MediaRepository {
  findById(id: string): Promise<Media | null>;
  save(media: Media): Promise<Media>;
  delete(id: string): Promise<void>;
}
