import { getSupabaseAdmin } from "@/lib/supabase";
import type { ContactRepository } from "@/repositories/interfaces/contact.repository";
import type { ContactRow, Json } from "@/types/database";
import type { Contact } from "@/types/whatsapp";

function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    waId: row.wa_id ?? undefined,
    profileName: row.profile_name ?? undefined,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseContactRepository implements ContactRepository {
  async findById(id: string): Promise<Contact | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapContact(data) : null;
  }

  async findByPhone(phoneNumber: string): Promise<Contact | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("contacts")
      .select("*")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapContact(data) : null;
  }

  async upsert(contact: Contact): Promise<Contact> {
    const { data, error } = await getSupabaseAdmin()
      .from("contacts")
      .upsert(
        {
          id: contact.id || undefined,
          phone_number: contact.phoneNumber,
          wa_id: contact.waId ?? null,
          profile_name: contact.profileName ?? null,
          metadata: (contact.metadata as Json | undefined) ?? {},
        },
        { onConflict: "phone_number" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapContact(data);
  }

  async list(params?: { limit?: number; cursor?: string }): Promise<Contact[]> {
    let query = getSupabaseAdmin()
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 50);

    if (params?.cursor) {
      query = query.lt("created_at", params.cursor);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data ?? []).map(mapContact);
  }
}
