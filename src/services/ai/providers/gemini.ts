import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProvider,
} from "@/services/ai/types";

/**
 * Stub Gemini. Implementar cuando se active IA.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    void input;
    throw new Error(
      "GeminiProvider no implementado. Configura GEMINI_API_KEY y completa este provider.",
    );
  }
}
