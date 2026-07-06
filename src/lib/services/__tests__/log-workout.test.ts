import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { logWorkout } from '../workouts/log-workout';
import { getCollection } from '../../data/get-collection';
import { UserMongoDoc } from '../../data/user-db';
import { ObjectId } from 'mongodb';
import { ensureIndexes } from '../../data/ensure-indexes';
import crypto from 'crypto';

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

    // Ensure MongoDB indexes are created in the test DB (especially the idempotency index)
    await ensureIndexes();
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

  it('should enforce idempotency and reject duplicate requests', async () => {
    const idempotencyKey = crypto.randomUUID();
    const workoutInput = {
      type: "cardio" as const,
      title: "Evening Run",
      duration: 30,
      difficulty: "easy" as const,
      exercises: [{ name: "Jogging", sets: 1, reps: 1, weight: null }],
      idempotencyKey
    };

    // 1. First request should succeed
    const firstWorkout = await logWorkout(workoutInput, userId);
    expect(firstWorkout.id).toBeDefined();

    // 2. Capture user stats after first request
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    const userAfterFirst = await usersCol.findOne({ _id: new ObjectId(userId) });
    const xpAfterFirst = userAfterFirst!.xp;

    // 3. Second request with same idempotencyKey should throw our specific error
    await expect(logWorkout(workoutInput, userId)).rejects.toThrow("This workout was already logged.");

    // 4. Verify user stats did NOT increment a second time
    const userAfterSecond = await usersCol.findOne({ _id: new ObjectId(userId) });
    expect(userAfterSecond!.xp).toBe(xpAfterFirst);

    // 5. Verify only ONE workout exists in the DB with this key
    const workoutsCol = await getCollection("workoutsCollection");
    const duplicateCount = await workoutsCol.countDocuments({ userId, idempotencyKey });
    expect(duplicateCount).toBe(1);
  });

  describe('Stamina System Integration', () => {
    it('should correctly deduct stamina for a normal workout', async () => {
      // 1. Arrange: Update the dummy user to have 100 stamina
      const usersCol = await getCollection<UserMongoDoc>("usersCollection");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 100, lastStaminaUpdate: new Date().toISOString() } });

      const workoutInput = {
        type: "strength" as const,
        title: "Normal Workout",
        duration: 60, // 60 min -> 15 + 30 = 45 cost
        difficulty: "moderate" as const,
        exercises: [{ name: "Squats", sets: 3, reps: 10, weight: 225 }]
      };

      // 2. Act
      await logWorkout(workoutInput, userId);

      // 3. Assert
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(55); // 100 - 45 = 55
    });

    it('should apply exhaustion debuff if stamina is 0', async () => {
      // 1. Arrange: Update the dummy user to have 0 stamina
      const usersCol = await getCollection<UserMongoDoc>("usersCollection");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 0, lastStaminaUpdate: new Date().toISOString() } });

      const workoutInput = {
        type: "cardio" as const,
        title: "Exhausted Workout",
        duration: 60, // Base XP: 60*2 + 1*15 = 135
        difficulty: "hard" as const,
        exercises: [{ name: "Running", sets: 1, reps: 1, weight: null }]
      };

      // 2. Act
      const workout = await logWorkout(workoutInput, userId);

      // 3. Assert
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(0); // Can't go below 0
      expect(workout.xpEarned).toBe(Math.round(135 * 0.5)); // 68
    });

    it('should process lazy recovery before applying cost', async () => {
      // 1. Arrange: Update the dummy user to have 10 stamina, updated 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      const usersCol = await getCollection<UserMongoDoc>("usersCollection");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 10, lastStaminaUpdate: twoDaysAgo.toISOString() } });

      const workoutInput = {
        type: "strength" as const,
        title: "Recovered Workout",
        duration: 60, // 45 cost
        difficulty: "moderate" as const,
        exercises: [{ name: "Squats", sets: 3, reps: 10, weight: 225 }]
      };

      // 2. Act
      await logWorkout(workoutInput, userId);

      // 3. Assert
      // Recovery: 10 + (2*50) = 110 -> 100
      // Cost: 100 - 45 = 55
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(55);
    });
  });
});
