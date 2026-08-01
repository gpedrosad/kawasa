import type { Contact } from "@/types/whatsapp";

/**
 * Puerto de persistencia de contactos.
 * Implementar luego con Prisma/PostgreSQL sin tocar la lógica de negocio.
 */
export interface ContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByPhone(phoneNumber: string): Promise<Contact | null>;
  upsert(contact: Contact): Promise<Contact>;
  list(params?: { limit?: number; cursor?: string }): Promise<Contact[]>;
}
