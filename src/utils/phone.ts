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

/**
 * Formas en que puede estar guardado un celular argentino en `contacts.phone_number`
 * (Kapso lo da como 54 + 10 dígitos, sin el 9). Acepta lo que escribe una persona:
 * +54 9 11 2233-4455, 011 15 2233-4455, 1122334455. Si no parece argentino, devuelve
 * solo los dígitos.
 */
export function argentinePhoneCandidates(phone: string): string[] {
  let digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  if (!digits) {
    return [];
  }

  const hasCountryCode = digits.startsWith("54") && digits.length >= 12;
  if (!hasCountryCode && (digits.length < 10 || digits.length > 13)) {
    return [digits];
  }

  let national = hasCountryCode ? digits.slice(2) : digits;
  if (national.length === 11 && national.startsWith("9")) {
    national = national.slice(1);
  }
  if (national.startsWith("0")) {
    national = national.slice(1);
  }
  // 11 15 2233-4455 → 11 2233-4455 (el 15 va después de la característica de 2 a 4 dígitos).
  if (national.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (national.slice(areaLength, areaLength + 2) === "15") {
        national = national.slice(0, areaLength) + national.slice(areaLength + 2);
        break;
      }
    }
  }

  if (national.length !== 10) {
    return [digits];
  }
  digits = `54${national}`;
  return [digits, `549${national}`];
}
