import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * A/B del primer mensaje a leads de anuncios. Antes de escribir, el anuncio ya le mostró
 * el saludo de Gonzalo («Contame a qué te dedicás…») y la persona casi siempre manda
 * «Hola! Vi el anuncio, ¿cómo funciona?». Este es nuestro primer mensaje de respuesta:
 * texto fijo (no lo escribe la IA), después sigue el agente.
 *
 * Para cambiar la prueba: sacar la perdedora de ACTIVE y sumar una nueva con id nuevo
 * (nunca reusar un id con otro texto, se mezclan los resultados). Resultados en la vista
 * opening_message_summary de KaWa. Doc: nuevonext MARKETING/whatsapp/agente-ventas-anuncio.md.
 */
export const OPENING_VARIANTS = {
  // Lo que venía escribiendo el agente (v3/v4): explica en una línea y pregunta.
  explica_y_pregunta:
    "es un link con tus horarios libres, tus pacientes o clientes reservan solos y les llegan recordatorios por whatsapp. vos a qué te dedicás? así te cuento con tu caso",
  // Como el saludo de Gonzalo de octubre (13 de 15 contestaron): primero pregunta.
  solo_pregunta: "hola! te explico con tu caso así es más fácil, vos a qué te dedicás?",
  // El saludo de Gonzalo tal cual (oct: 12 de 14 contestaron; las dos de arriba, 0 de 12).
  // Va solo al 100% desde 2026-10-25, junto con la campaña nueva (EXP-004).
  saludo_gonzalo:
    "hola! cómo andás?\nsoy gonzalo, de agendapp. contame a qué te dedicás así te explico con tu caso",
} as const;

export type OpeningVariant = keyof typeof OPENING_VARIANTS;

/** Variantes que se están probando ahora. */
export const ACTIVE_OPENING_VARIANTS: OpeningVariant[] = ["saludo_gonzalo"];

/** La variante con menos leads asignados (muestras parejas aunque entren pocos por día). */
export function pickOpeningVariant(
  counts: Partial<Record<OpeningVariant, number>>,
  random = Math.random,
): OpeningVariant {
  const min = Math.min(...ACTIVE_OPENING_VARIANTS.map((variant) => counts[variant] ?? 0));
  const tied = ACTIVE_OPENING_VARIANTS.filter((variant) => (counts[variant] ?? 0) === min);
  return tied[Math.floor(random() * tied.length)] ?? tied[0]!;
}

/**
 * Le asigna el primer mensaje a un teléfono. Devuelve null si ya tenía uno (otro mensaje
 * entró a la vez): en ese caso no se manda de nuevo.
 */
export async function assignOpeningMessage(
  phoneNumber: string,
): Promise<{ variant: OpeningVariant; message: string } | null> {
  const db = getSupabaseAdmin();

  const { data: rows, error: countError } = await db
    .from("opening_messages")
    .select("variant")
    .in("variant", ACTIVE_OPENING_VARIANTS);
  if (countError) {
    throw countError;
  }
  const counts: Partial<Record<OpeningVariant, number>> = {};
  for (const row of rows ?? []) {
    const variant = row.variant as OpeningVariant;
    counts[variant] = (counts[variant] ?? 0) + 1;
  }

  const variant = pickOpeningVariant(counts);
  const message = OPENING_VARIANTS[variant];
  const { data: inserted, error } = await db
    .from("opening_messages")
    .upsert(
      { phone_number: phoneNumber, variant, message },
      { onConflict: "phone_number", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    throw error;
  }

  return inserted && inserted.length > 0 ? { variant, message } : null;
}
