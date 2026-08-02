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
  /** Si se setea, al entrar a esta etapa se registra conversión (pending CAPI). */
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
    conversionEvent: "Lead",
    description: "Lead caliente → conversión Meta Lead",
  },
  {
    id: "ganado",
    label: "Ganado",
    conversionEvent: "Subscribe",
    description: "Se suscribió → conversión Meta Subscribe",
  },
  {
    id: "perdido",
    label: "Perdido",
    conversionEvent: null,
    description: "No-fit o descartado",
  },
];

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
