import { CustomExercise, TargetMuscle } from "@/lib/types";

export async function createCustomExercise(data: { name: string, targetMuscle: TargetMuscle }): Promise<CustomExercise> {
    const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create exercise");
    }
    return res.json();
}

export async function fetchCustomExercises(): Promise<CustomExercise[]> {
    const res = await fetch("/api/exercises");
    if (!res.ok) throw new Error("Failed to fetch custom exercises");
    return res.json();
}
