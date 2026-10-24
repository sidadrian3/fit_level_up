import { findWorkoutDatesInRange } from "./workout.repository";

export function getWorkoutDatesInRange(userId: string, from: Date, toExclusive: Date): Promise<Date[]> {
    return findWorkoutDatesInRange(userId, from, toExclusive);
}
