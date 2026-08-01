/**
 * URL pública absoluta de la app (para media LINK que Meta/Kapso deben fetchar).
 */
export function getPublicAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${productionHost.replace(/\/$/, "")}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://kawasa.vercel.app";
  }

  return "http://localhost:3000";
}
