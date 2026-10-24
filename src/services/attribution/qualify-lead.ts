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
  "depila",
  "manicur",
  "peluquer",
  "barber",
  "coach",
  "profesor",
  "entrenador",
  "yoga",
  "pilates",
  "constelacion",
  "consultorio",
  "clinica",
  "holistic",
  "reiki",
];

/**
 * Formas cortas que la gente escribe en el chat («soy kine», «nutri», «psico»). Cuentan
 * solo al principio de una palabra: «fono» no tiene que matchear «teléfono».
 */
const PROFESSION_WORD_STARTS = [
  "kine",
  "nutri",
  "psico",
  "fono",
  "fisio",
  "odonto",
  "dermat",
  "cosmiatr",
  "acupunt",
  "reflexolog",
  "cejas",
  "nail",
  "maquill",
  "tatu",
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
  return (
    PROFESSION_STEMS.find((stem) => normalized.includes(stem)) ??
    PROFESSION_WORD_STARTS.find((stem) => new RegExp(`\\b${stem}`).test(normalized)) ??
    null
  );
}

/** Último clic en un anuncio del contacto, si está dentro de la ventana de Meta. */
async function findRecentAdTouch(contactId: string): Promise<{ id: string } | null> {
  const { data: touch, error } = await getSupabaseAdmin()
    .from("ad_touches")
    .select("id, touched_at")
    .eq("contact_id", contactId)
    .not("ctwa_clid", "is", null)
    .order("touched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!touch || Date.now() - new Date(touch.touched_at).getTime() > AD_WINDOW_MS) {
    return null;
  }
  return touch;
}

/**
 * LeadSubmitted (el evento que optimiza la campaña de leads por WhatsApp, EXP-003) cuando
 * quien vino de un anuncio contesta un mensaje nuestro. El cuello de botella es que
 * contesten (2026-10-24: 0 de 6 contestaron el primer mensaje), así que Meta busca gente
 * que contesta. Una vez por contacto; las reacciones no cuentan.
 */
export async function maybeMarkReplyLead(input: {
  contactId: string;
  conversationId: string;
  messageType: string | null | undefined;
}): Promise<boolean> {
  if (input.messageType === "reaction") {
    return false;
  }

  const { data: outbound, error } = await getSupabaseAdmin()
    .from("messages")
    .select("id")
    .eq("contact_id", input.contactId)
    .eq("direction", "outbound")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!outbound || !(await findRecentAdTouch(input.contactId))) {
    return false;
  }

  const conversion = await recordConversion({
    eventName: "LeadSubmitted",
    contactId: input.contactId,
    conversationId: input.conversationId,
    eventId: `${input.contactId}:LeadSubmitted`,
    customData: { source: "auto_reply" },
  });
  if (conversion.created) {
    logger.info("Lead que contestó: LeadSubmitted", {
      contactId: input.contactId,
      status: conversion.status,
    });
  }
  return conversion.created;
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

  if (!(await findRecentAdTouch(input.contactId))) {
    return false;
  }

  const conversion = await recordConversion({
    eventName: "QualifiedLead",
    contactId: input.contactId,
    conversationId: input.conversationId,
    eventId: `${input.contactId}:QualifiedLead`,
    customData: { source: "auto_profession", matched: stem },
  });
  // LeadSubmitted normalmente ya salió cuando contestó (maybeMarkReplyLead); si nombró la
  // profesión antes de que le escribiéramos, sale acá. Mismo event_id: nunca se duplica.
  await recordConversion({
    eventName: "LeadSubmitted",
    contactId: input.contactId,
    conversationId: input.conversationId,
    eventId: `${input.contactId}:LeadSubmitted`,
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
