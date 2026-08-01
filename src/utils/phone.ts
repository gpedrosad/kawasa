const DIGITS_ONLY = /^\d+$/;
const E164_LIKE = /^\+?[1-9]\d{7,14}$/;

/**
 * Normaliza un teléfono a dígitos E.164 sin "+", listo para WhatsApp Cloud API.
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");

  if (!digits) {
    throw new Error("Número de teléfono vacío o inválido");
  }

  if (hasPlus || E164_LIKE.test(trimmed)) {
    return digits;
  }

  return digits;
}

/**
 * Valida formato internacional (E.164).
 * Acepta con o sin prefijo "+".
 */
export function isValidInternationalPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("+")) {
    return E164_LIKE.test(trimmed);
  }

  return DIGITS_ONLY.test(trimmed) && E164_LIKE.test(trimmed);
}

export function assertValidInternationalPhone(phone: string): string {
  const normalized = normalizePhone(phone);

  if (!isValidInternationalPhone(normalized) && !isValidInternationalPhone(`+${normalized}`)) {
    throw new Error(
      `Número internacional inválido: "${phone}". Usa formato E.164 (ej: +56912345678).`,
    );
  }

  return normalized;
}
