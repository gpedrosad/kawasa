import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProvider,
} from "@/services/ai/types";

/**
 * Stub OpenAI. Implementar cuando se active IA.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    void input;
    throw new Error(
      "OpenAiProvider no implementado. Configura OPENAI_API_KEY y completa este provider.",
    );
  }
}
