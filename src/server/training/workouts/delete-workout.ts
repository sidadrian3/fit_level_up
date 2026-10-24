import { deleteWorkoutById } from "./workout.repository";

export function deleteWorkout(userId: string, workoutId: string): Promise<boolean> {
    return deleteWorkoutById(userId, workoutId);
}
