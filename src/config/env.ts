import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  KAPSO_API_KEY: z
    .string({ error: "KAPSO_API_KEY es requerida" })
    .min(1, "KAPSO_API_KEY no puede estar vacía"),
  KAPSO_PHONE_NUMBER_ID: z
    .string({ error: "KAPSO_PHONE_NUMBER_ID es requerida" })
    .min(1, "KAPSO_PHONE_NUMBER_ID no puede estar vacía"),
  KAPSO_WEBHOOK_SECRET: z
    .string({ error: "KAPSO_WEBHOOK_SECRET es requerida" })
    .min(1, "KAPSO_WEBHOOK_SECRET no puede estar vacía"),
  KAPSO_BASE_URL: z
    .string()
    .url()
    .default("https://api.kapso.ai/meta/whatsapp"),
  SUPABASE_URL: z
    .string({ error: "SUPABASE_URL es requerida" })
    .url()
    .default("https://dkpihigjlifjvxiszkew.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ error: "SUPABASE_SERVICE_ROLE_KEY es requerida" })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY no puede estar vacía"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function formatEnvErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
}

/**
 * Valida y cachea variables de entorno del servidor.
 * Lanza un error claro si falta alguna variable crítica de Kapso.
 * Nunca uses NEXT_PUBLIC_* para secretos.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    KAPSO_API_KEY: process.env.KAPSO_API_KEY,
    KAPSO_PHONE_NUMBER_ID: process.env.KAPSO_PHONE_NUMBER_ID,
    KAPSO_WEBHOOK_SECRET: process.env.KAPSO_WEBHOOK_SECRET,
    KAPSO_BASE_URL: process.env.KAPSO_BASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas o faltantes:\n${formatEnvErrors(parsed.error)}\n\nCopia .env.example a .env.local y completa los valores de Kapso.`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
