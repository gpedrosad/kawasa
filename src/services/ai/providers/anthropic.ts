import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProvider,
} from "@/services/ai/types";

/**
 * Stub Anthropic. Implementar cuando se active IA.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    void input;
    throw new Error(
      "AnthropicProvider no implementado. Configura ANTHROPIC_API_KEY y completa este provider.",
    );
  }
}
