import { getSupabaseAdmin } from "@/lib/supabase";
import type { ConversationRepository } from "@/repositories/interfaces/conversation.repository";
import type { ConversationRow, Json } from "@/types/database";
import type { Conversation } from "@/types/whatsapp";

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    phoneNumberId: row.phone_number_id ?? undefined,
    status: row.status,
    lastActiveAt: row.last_message_at ?? undefined,
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseConversationRepository implements ConversationRepository {
  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapConversation(data) : null;
  }

  async findByPhone(phoneNumber: string): Promise<Conversation | null> {
    const { data: contact, error: contactError } = await getSupabaseAdmin()
      .from("contacts")
      .select("id")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (contactError) {
      throw contactError;
    }

    if (!contact) {
      return null;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .select("*")
      .eq("contact_id", contact.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapConversation(data) : null;
  }

  async upsert(conversation: Conversation): Promise<Conversation> {
    if (!conversation.phoneNumber) {
      throw new Error("Conversation.upsert requiere phoneNumber");
    }

    const { data: contact, error: contactError } = await getSupabaseAdmin()
      .from("contacts")
      .upsert(
        {
          phone_number: conversation.phoneNumber,
          profile_name: conversation.contactName ?? null,
        },
        { onConflict: "phone_number" },
      )
      .select("id")
      .single();

    if (contactError) {
      throw contactError;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("conversations")
      .upsert(
        {
          id: conversation.id,
          contact_id: contact.id,
          phone_number_id: conversation.phoneNumberId ?? null,
          status: conversation.status ?? "active",
          last_message_at: conversation.lastActiveAt ?? null,
          last_inbound_at: conversation.lastInboundAt ?? null,
          last_outbound_at: conversation.lastOutboundAt ?? null,
          metadata: (conversation.metadata as Json | undefined) ?? {},
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapConversation(data);
  }

  async list(params?: {
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Conversation[]> {
    let query = getSupabaseAdmin()
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(params?.limit ?? 50);

    if (params?.status) {
      query = query.eq("status", params.status);
    }

    if (params?.cursor) {
      query = query.lt("last_message_at", params.cursor);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map(mapConversation);
  }
}
