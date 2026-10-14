import { NextResponse, type NextRequest } from "next/server";

/**
 * Pide clave (Basic Auth) para todo salvo el webhook de Kapso (ya firmado
 * con HMAC) y los audios públicos que Meta descarga.
 * La clave va en CRM_PASSWORD (el repo es público: nunca en el código).
 * Sin CRM_PASSWORD no deja entrar a nadie.
 */
export function middleware(request: NextRequest): NextResponse {
  const password = process.env.CRM_PASSWORD;
  const header = request.headers.get("authorization") ?? "";

  if (password && header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice("Basic ".length));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) {
        return NextResponse.next();
      }
    } catch {
      // Header mal formado: cae al 401.
    }
  }

  return new NextResponse("Clave requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="KaWa CRM", charset="UTF-8"' },
  });
}

export const config = {
  matcher: [
    "/((?!api/webhooks/|sounds/|_next/static|_next/image|favicon.ico).*)",
  ],
};
