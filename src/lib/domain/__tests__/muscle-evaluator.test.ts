import { calcMuscleVolume } from "../muscle-evaluator";
import { TargetMuscle, Workout } from "../../types";
import { describe, it, expect } from "vitest";

describe("muscle-evaluator", () => {
    describe("calcMuscleVolume", () => {
        it("should calculate correct muscle intensity based on pure sets and reps", () => {
            const mockWorkouts: Workout[] = [{
                id: "1",
                title: "Push Day",
                duration: 60,
                xpEarned: 100,
                date: new Date().toISOString(),
                exercises: [
                    { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 5, reps: 10, weight: 100 }, // 50 reps -> medium
                    { name: "Tricep Pushdown", targetMuscle: TargetMuscle.Arms, sets: 3, reps: 15, weight: 50 }, // 45 reps -> medium
                    { name: "Pushups", targetMuscle: TargetMuscle.Chest, sets: 5, reps: 20, weight: null } // 100 reps + 50 above = 150 -> high
                ]
            }];

            const result = calcMuscleVolume(mockWorkouts, 7);
            
            // Chest is 150 total reps -> high
            expect(result[TargetMuscle.Chest]).toBe("high");
            
            // Arms is 45 total reps -> medium
            expect(result[TargetMuscle.Arms]).toBe("medium");
            
            // Legs is 0 reps -> inactive
            expect(result[TargetMuscle.Legs]).toBe("inactive");
        });

        it("should filter out workouts older than the specified days", () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

            const mockWorkouts: Workout[] = [{
                id: "1",
                title: "Leg Day (Old)",
                duration: 60,
                xpEarned: 100,
                date: oldDate.toISOString(),
                exercises: [
                    { name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 10, reps: 20, weight: 100 } // 200 reps
                ]
            }];

            const result = calcMuscleVolume(mockWorkouts, 7);
            
            // Should be inactive because the workout is 10 days old, but we only asked for 7 days
            expect(result[TargetMuscle.Legs]).toBe("inactive");
        });
    });
});
