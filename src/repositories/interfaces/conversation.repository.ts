import type { Conversation } from "@/types/whatsapp";

/**
 * Puerto de persistencia de conversaciones.
 */
export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByPhone(phoneNumber: string): Promise<Conversation | null>;
  upsert(conversation: Conversation): Promise<Conversation>;
  list(params?: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Conversation[]>;
}
