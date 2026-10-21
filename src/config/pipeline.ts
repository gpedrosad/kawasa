import type { ConversionEventName } from "@/types/attribution";

export const PIPELINE_STAGE_IDS = [
  "nuevo",
  "calificado",
  "interesado",
  "lead",
  "ganado",
  "perdido",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  /** Si se setea, al entrar a esta etapa se registra la conversión y se manda a Meta CAPI. */
  conversionEvent: ConversionEventName | null;
  description: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "nuevo",
    label: "Nuevo",
    conversionEvent: null,
    description: "Primer contacto / sin calificar",
  },
  {
    id: "calificado",
    label: "Calificado",
    conversionEvent: null,
    description: "Profesión / contexto claro",
  },
  {
    id: "interesado",
    label: "Interesado",
    conversionEvent: null,
    description: "Miró landing o pidió más info",
  },
  {
    id: "lead",
    label: "Lead",
    conversionEvent: "QualifiedLead",
    description: "Profesional que vale la pena → Meta QualifiedLead",
  },
  {
    id: "ganado",
    label: "Ganado",
    conversionEvent: "Purchase",
    description: "Pagó la suscripción → Meta Purchase",
  },
  {
    id: "perdido",
    label: "Perdido",
    conversionEvent: null,
    description: "No-fit o descartado",
  },
];

/** Valor de la suscripción mensual que se manda con Purchase. */
export const SUBSCRIPTION_VALUE = { value: 18000, currency: "ARS" } as const;

/** Link personal que se le manda por WhatsApp: AgendApp avisa si lo abre y si paga. */
export function buildPersonalLink(waRef: string): string {
  return `https://www.agendapp.com.ar/empezar?wa=${waRef}`;
}

/** Una etapa solo avanza: nunca vuelve atrás ni sale de «perdido» sola. */
export function isStageAhead(
  current: PipelineStageId,
  next: PipelineStageId,
): boolean {
  if (current === "perdido" || next === "perdido") {
    return false;
  }
  return PIPELINE_STAGE_IDS.indexOf(next) > PIPELINE_STAGE_IDS.indexOf(current);
}

export function isPipelineStageId(value: string): value is PipelineStageId {
  return (PIPELINE_STAGE_IDS as readonly string[]).includes(value);
}

export function getPipelineStage(id: PipelineStageId): PipelineStage {
  const stage = PIPELINE_STAGES.find((item) => item.id === id);
  if (!stage) {
    throw new Error(`Etapa de pipeline desconocida: ${id}`);
  }
  return stage;
}
