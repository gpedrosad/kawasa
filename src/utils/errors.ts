import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      details?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? "INTERNAL_ERROR";
    this.details = options?.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details,
    });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Firma de webhook inválida") {
    super(message, {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
    this.name = "UnauthorizedError";
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Error desconocido";
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    logger.warn("Validación fallida", { issues: error.issues });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Payload inválido",
          details: error.issues,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    logger.warn(error.message, {
      code: error.code,
      details: error.details,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode },
    );
  }

  logger.error("Error no controlado", {
    message: toErrorMessage(error),
  });

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
      },
    },
    { status: 500 },
  );
}
