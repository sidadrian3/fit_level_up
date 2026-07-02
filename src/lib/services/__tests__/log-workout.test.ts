import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { logWorkout } from '../workouts/log-workout';
import { getCollection } from '../../data/get-collection';
import { UserMongoDoc } from '../../data/user-db';
import { ObjectId } from 'mongodb';

describe('logWorkout Integration Test', () => {
  let userId: string;

  beforeAll(async () => {
    // Setup a dummy user in the empty in-memory db
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    const result = await usersCol.insertOne({
      email: "test@example.com",
      name: "Test User",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      createdAt: new Date(),
    });
    userId = result.insertedId.toString();
  });

  afterEach(async () => {
    // Clean up workouts between tests
    const workoutsCol = await getCollection("workoutsCollection");
    await workoutsCol.deleteMany({});
  });

  it('should successfully log a workout, calculate XP, and update user stats', async () => {
    const workoutInput = {
      type: "strength" as const,
      title: "Morning Lift",
      duration: 60,
      difficulty: "moderate" as const,
      exercises: [
        { name: "Bench Press", sets: 3, reps: 10, weight: 135 },
        { name: "Squats", sets: 3, reps: 10, weight: 225 }
      ]
    };

    const workout = await logWorkout(workoutInput, userId);

    // 1. Verify workout was created
    expect(workout.id).toBeDefined();
    expect(workout.title).toBe("Morning Lift");
    expect(workout.xpEarned).toBeGreaterThan(0);

    // 2. Verify user stats were updated
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    const user = await usersCol.findOne({ _id: new ObjectId(userId) });

    expect(user).toBeDefined();
    expect(user!.totalWorkouts).toBe(1); // incremented
    expect(user!.xp).toBe(workout.xpEarned); // XP granted
    expect(user!.streak).toBe(1); // Streak started
  });
});
