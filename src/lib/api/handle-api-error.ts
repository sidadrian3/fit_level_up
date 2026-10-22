import type { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/platform/http";

export function handleApiError(err: unknown): NextResponse {
  return toErrorResponse(err, "legacy");
}
