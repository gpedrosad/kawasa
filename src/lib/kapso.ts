import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { getEnv } from "@/config/env";

let client: WhatsAppClient | null = null;

/**
 * Singleton del cliente oficial Kapso (WhatsApp Cloud API).
 * Solo usar en servidor. Los secretos nunca se exponen al frontend.
 */
export function getKapsoClient(): WhatsAppClient {
  if (client) {
    return client;
  }

  const env = getEnv();

  client = new WhatsAppClient({
    baseUrl: env.KAPSO_BASE_URL,
    kapsoApiKey: env.KAPSO_API_KEY,
  });

  return client;
}

export function getKapsoPhoneNumberId(): string {
  return getEnv().KAPSO_PHONE_NUMBER_ID;
}

export function resetKapsoClient(): void {
  client = null;
}
