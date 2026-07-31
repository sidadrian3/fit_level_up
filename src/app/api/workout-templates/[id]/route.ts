import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { deleteWorkoutTemplateFromDb } from "@/lib/data/workout-templates-db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const { id } = await params;
    
    const deleted = await deleteWorkoutTemplateFromDb(userId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}