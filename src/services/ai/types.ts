export type AiProviderName = "openai" | "anthropic" | "gemini";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiGenerateInput {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface AiGenerateResult {
  provider: AiProviderName;
  model: string;
  text: string;
  raw?: unknown;
}

/**
 * Contrato desacoplado para proveedores de IA.
 * Intercambia OpenAI / Anthropic / Gemini sin tocar la lógica de negocio.
 */
export interface AiProvider {
  readonly name: AiProviderName;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
}
