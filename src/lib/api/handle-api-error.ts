import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
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
