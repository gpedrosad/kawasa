import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  MessageRepository,
  StoredMessage,
} from "@/repositories/interfaces/message.repository";
import type { Json, MessageRow } from "@/types/database";
import type {
  IncomingMessage,
  Media,
  MessageDirection,
  MessageType,
  OutgoingMessage,
} from "@/types/whatsapp";

function mapMedia(value: Json | null): Media | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const media = value as Record<string, unknown>;
  return {
    id: typeof media.id === "string" ? media.id : undefined,
    link: typeof media.link === "string" ? media.link : undefined,
    mimeType:
      typeof media.mime_type === "string"
        ? media.mime_type
        : typeof media.mimeType === "string"
          ? media.mimeType
          : undefined,
    filename: typeof media.filename === "string" ? media.filename : undefined,
    caption: typeof media.caption === "string" ? media.caption : undefined,
    voice: typeof media.voice === "boolean" ? media.voice : undefined,
    url: typeof media.url === "string" ? media.url : undefined,
  };
}

function toMediaJson(media: Media | undefined): Json | null {
  if (!media) {
    return null;
  }

  return {
    id: media.id ?? null,
    link: media.link ?? null,
    mime_type: media.mimeType ?? null,
    filename: media.filename ?? null,
    caption: media.caption ?? null,
    voice: media.voice ?? null,
    url: media.url ?? null,
  };
}

function mapMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    providerMessageId: row.provider_message_id,
    conversationId: row.conversation_id,
    timestamp: row.occurred_at ?? undefined,
    type: row.type as MessageType,
    direction: row.direction as MessageDirection,
    status: row.status as StoredMessage["status"],
    text: row.text ?? undefined,
    media: mapMedia(row.media),
    createdAt: row.created_at,
    raw:
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? (row.raw as Record<string, unknown>)
        : undefined,
  };
}

export class SupabaseMessageRepository implements MessageRepository {
  async findById(id: string): Promise<StoredMessage | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapMessage(data) : null;
  }

  async saveIncoming(message: IncomingMessage): Promise<StoredMessage> {
    if (!message.conversationId) {
      throw new Error("saveIncoming requiere conversationId");
    }

    const contactId =
      typeof message.raw?.contactId === "string"
        ? message.raw.contactId
        : null;

    const { data, error } = await getSupabaseAdmin()
      .from("messages")
      .upsert(
        {
          provider_message_id: message.id,
          conversation_id: message.conversationId,
          contact_id: contactId,
          direction: "inbound",
          type: message.type,
          status: message.status ?? "received",
          text: message.text ?? null,
          media: toMediaJson(message.media),
          occurred_at: message.timestamp ?? null,
          raw: (message.raw as Json | undefined) ?? null,
        },
        { onConflict: "provider_message_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapMessage(data);
  }

  async saveOutgoing(
    message: OutgoingMessage,
    providerMessageId: string,
  ): Promise<StoredMessage> {
    const conversationId =
      typeof (message as OutgoingMessage & { conversationId?: string })
        .conversationId === "string"
        ? (message as OutgoingMessage & { conversationId?: string })
            .conversationId
        : undefined;

    if (!conversationId) {
      throw new Error("saveOutgoing requiere conversationId en el mensaje");
    }

    const { data, error } = await getSupabaseAdmin()
      .from("messages")
      .upsert(
        {
          provider_message_id: providerMessageId,
          conversation_id: conversationId,
          direction: "outbound",
          type: message.type,
          status: "sent",
          text: message.text ?? null,
          media: toMediaJson(message.media),
          context_message_id: message.contextMessageId ?? null,
        },
        { onConflict: "provider_message_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapMessage(data);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const byId = await getSupabaseAdmin()
      .from("messages")
      .update({ status })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (byId.error) {
      throw byId.error;
    }

    if (byId.data) {
      return;
    }

    const { error } = await getSupabaseAdmin()
      .from("messages")
      .update({ status })
      .eq("provider_message_id", id);

    if (error) {
      throw error;
    }
  }

  async listByConversation(
    conversationId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<StoredMessage[]> {
    let query = getSupabaseAdmin()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 50);

    if (params?.cursor) {
      query = query.lt("created_at", params.cursor);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map(mapMessage);
  }
}
