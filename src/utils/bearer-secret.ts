import { timingSafeEqual } from "node:crypto";

/**
 * Compara `Authorization: Bearer <clave>` contra las claves aceptadas sin filtrar
 * por tiempo cuál difiere. Claves vacías o ausentes nunca autorizan.
 */
export function hasBearerSecret(
  authorization: string | null,
  secrets: Array<string | undefined>,
): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const given = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  return secrets.some((secret) => {
    if (!secret) {
      return false;
    }
    const expected = Buffer.from(secret, "utf8");
    return (
      expected.length === given.length && timingSafeEqual(expected, given)
    );
  });
}
