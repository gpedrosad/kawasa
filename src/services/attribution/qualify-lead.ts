import { logger } from "@/lib/logger";
import { getSupabaseAdmin } from "@/lib/supabase";
import { recordConversion } from "@/services/attribution/record-conversion";
import { advanceConversationStage } from "@/services/crm/pipeline";

/** Meta atribuye al anuncio dentro de esta ventana desde el clic. */
const AD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Raíces de profesiones que atienden con turnos (texto sin tildes, en minúscula).
 * Afuera a propósito: «terapia» y «unas» (los dice también un paciente o cualquiera).
 */
const PROFESSION_STEMS = [
  "psicolog",
  "psiquiatr",
  "psicopedagog",
  "kinesiolog",
  "fisioterap",
  "osteopat",
  "nutricion",
  "odontolog",
  "dentist",
  "medic",
  "pediatr",
  "fonoaudiolog",
  "podolog",
  "terapeut",
  "masaj",
  "estetic",
  "cosmetolog",
  "lash",
  "pestan",
  "manicur",
  "peluquer",
  "barber",
  "coach",
  "profesor",
  "entrenador",
  "yoga",
  "pilates",
  "consultorio",
  "clinica",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Devuelve la raíz encontrada, o null si el texto no menciona una profesión. */
export function matchProfession(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const normalized = normalize(text);
  return PROFESSION_STEMS.find((stem) => normalized.includes(stem)) ?? null;
}

/**
 * Escalón 2 de la escalera: quien vino de un anuncio y cuenta a qué se dedica
 * pasa a QualifiedLead (una vez por contacto) y su tarjeta avanza a «Lead».
 */
export async function maybeQualifyLead(input: {
  contactId: string;
  conversationId: string;
  text: string | null | undefined;
}): Promise<boolean> {
  const stem = matchProfession(input.text);
  if (!stem) {
    return false;
  }

  const { data: touch, error } = await getSupabaseAdmin()
    .from("ad_touches")
    .select("id, touched_at")
    .eq("contact_id", input.contactId)
    .not("ctwa_clid", "is", null)
    .order("touched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!touch || Date.now() - new Date(touch.touched_at).getTime() > AD_WINDOW_MS) {
    return false;
  }

  const conversion = await recordConversion({
    eventName: "QualifiedLead",
    contactId: input.contactId,
    conversationId: input.conversationId,
    eventId: `${input.contactId}:QualifiedLead`,
    customData: { source: "auto_profession", matched: stem },
  });

  if (conversion.created) {
    await advanceConversationStage({
      conversationId: input.conversationId,
      stage: "lead",
    });
    logger.info("Lead calificado solo por profesión", {
      contactId: input.contactId,
      matched: stem,
      status: conversion.status,
    });
  }

  return conversion.created;
}
