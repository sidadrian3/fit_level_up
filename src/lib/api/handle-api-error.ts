import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";
import { DomainError, type DomainErrorKind } from "@/server/platform/domain";

const DOMAIN_ERROR_STATUS: Record<DomainErrorKind, number> = {
  invalid: 400,
  conflict: 409,
};

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }

  if (err instanceof DomainError) {
    return NextResponse.json({ error: err.message }, { status: DOMAIN_ERROR_STATUS[err.kind] });
  }

  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Unhandled crashes (e.g. Database connection lost, syntax errors, etc.)
  console.error("[Unhandled API Error]", err);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
