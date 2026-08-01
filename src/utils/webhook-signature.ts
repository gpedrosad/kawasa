import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma HMAC SHA256 de Kapso (`X-Webhook-Signature`).
 * Debe usarse el raw body (string), no un objeto ya parseado.
 */
export function verifyKapsoWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
