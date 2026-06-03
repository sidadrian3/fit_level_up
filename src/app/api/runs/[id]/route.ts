import { NextResponse } from "next/server";
import { deleteRunFromDb, getAllRunsFromDb, updateRunInDb  } from "@/lib/data/runs-db";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const result = await updateRunInDb(id, body);

        if (result === false) {
            return NextResponse.json(
                { error: "Run not found or invalid ID" },
                { status: 404 }
            );
        }
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const success = await deleteRunFromDb(id); 

        if (!success) {
            return NextResponse.json(
                { error: "Run not found or invalid ID" },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        console.error("DELETE /api/runs/[id] error:", err);
                return NextResponse.json(
                    { error: "Failed to delete run" },
                    { status: 500 }
                );    }

}