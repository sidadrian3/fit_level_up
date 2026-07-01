import { NextResponse } from "next/server";
import { deleteRunFromDb } from "@/lib/data/runs-db";
import { updateRun } from "@/lib/services/runs/update-run";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateRunSchema } from "@/lib/validations/schemas";
import { z } from "zod";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId();
        const { id } = await params;
        const body = await request.json();
        const parsed = CreateRunSchema.parse(body);
        const result = await updateRun(id, parsed, userId);

        if (!result) {
            return NextResponse.json(
                { error: "Run not found or invalid ID" },
                { status: 404 }
            );
        }
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json(
                { error: err.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            );
        }
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId();
        const { id } = await params;
        const success = await deleteRunFromDb(id, userId);

        if (!success) {
            return NextResponse.json(
                { error: "Run not found or invalid ID" },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        console.error("DELETE /api/runs/[id] error:", err);
        return NextResponse.json(
            { error: "Failed to delete run" },
            { status: 500 }
        );
    }
}