import type { IncomingMessage, OutgoingMessage } from "@/types/whatsapp";

export type StoredMessage = IncomingMessage & {
  providerMessageId?: string;
  conversationId?: string;
  createdAt?: string;
};

/**
 * Puerto de persistencia de mensajes.
 */
export interface MessageRepository {
  findById(id: string): Promise<StoredMessage | null>;
  saveIncoming(message: IncomingMessage): Promise<StoredMessage>;
  saveOutgoing(
    message: OutgoingMessage,
    providerMessageId: string,
  ): Promise<StoredMessage>;
  updateStatus(id: string, status: string): Promise<void>;
  listByConversation(
    conversationId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<StoredMessage[]>;
}
