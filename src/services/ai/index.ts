import { AnthropicProvider } from "@/services/ai/providers/anthropic";
import { GeminiProvider } from "@/services/ai/providers/gemini";
import { OpenAiProvider } from "@/services/ai/providers/openai";
import type { AiProvider, AiProviderName } from "@/services/ai/types";

export type * from "@/services/ai/types";
export { OpenAiProvider } from "@/services/ai/providers/openai";
export { AnthropicProvider } from "@/services/ai/providers/anthropic";
export { GeminiProvider } from "@/services/ai/providers/gemini";

export function createAiProvider(name: AiProviderName): AiProvider {
  switch (name) {
    case "openai":
      return new OpenAiProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "gemini":
      return new GeminiProvider();
    default: {
      const exhaustive: never = name;
      throw new Error(`Proveedor de IA no soportado: ${exhaustive}`);
    }
  }
}
