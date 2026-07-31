import { describe, it, expect, vi } from "vitest";
import { createWorkoutTemplate } from "../workout-templates/create-workout-template";
import * as workoutTemplatesDb from "@/lib/data/workout-templates-db";
import { TargetMuscle } from "@/lib/types";

vi.mock("@/lib/data/workout-templates-db", () => ({
    createWorkoutTemplateInDb: vi.fn(),
}));

describe("createWorkoutTemplate Service", () => {
    it("should generate a createdAt timestamp and delegate to the DB adapter", async () => {
        const mockInput = {
            name: "Upper Body Power",
            idempotencyKey: "test-idemp-123",
            exercises: [
                {
                    name: "Bench Press",
                    targetMuscle: TargetMuscle.Chest,
                    sets: 3,
                    reps: 5,
                    weight: 225
                }
            ]
        };
        const userId = "test-user-123";

        // Mock DB return
        vi.mocked(workoutTemplatesDb.createWorkoutTemplateInDb).mockResolvedValue({
            id: "fake-id",
            userId,
            ...mockInput,
            createdAt: new Date().toISOString()
        });

        const result = await createWorkoutTemplate(mockInput, userId);

        expect(workoutTemplatesDb.createWorkoutTemplateInDb).toHaveBeenCalledTimes(1);
        
        const callArgs = vi.mocked(workoutTemplatesDb.createWorkoutTemplateInDb).mock.calls[0][0];
        expect(callArgs.userId).toBe(userId);
        expect(callArgs.name).toBe("Upper Body Power");
        expect(callArgs.idempotencyKey).toBe("test-idemp-123");
        expect(callArgs.createdAt).toBeDefined();
        
        expect(result.name).toBe("Upper Body Power");
    });
});