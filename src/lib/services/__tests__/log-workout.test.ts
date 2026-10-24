import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { logWorkout } from '../workouts/log-workout';
import { updateWorkout } from '../workouts/update-workout';
import { IdempotencyKeyReusedError } from '@/server/platform/http';
import { getCollection, type UserDoc } from "@/server/platform/database";
import { ObjectId } from 'mongodb';
import { TargetMuscle } from '../../types';
import crypto from 'crypto';

describe('logWorkout Integration Test', () => {
  let userId: string;
  const request = (fingerprint = 'f1') => ({ key: crypto.randomUUID(), fingerprint });

  beforeAll(async () => {
    // Setup a dummy user in the empty in-memory db
    const usersCol = await getCollection<UserDoc>("user");
    const result = await usersCol.insertOne({
      email: "test@example.com",
      name: "Test User",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });
    userId = result.insertedId.toString();

    // Ensure MongoDB indexes are created in the test DB (especially the idempotency index)
  });

  beforeEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
  });

  afterEach(async () => {
    vi.useRealTimers();
    // Clean up workouts between tests
    const workoutsCol = await getCollection("workouts");
    await workoutsCol.deleteMany({});
  });

  it('should successfully log a workout, calculate XP, and update user stats', async () => {
    const workoutInput = {
      title: "Morning Lift",
      duration: 60,
      exercises: [
        { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: 135 },
        { name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 225 }
      ]
    };

    const { value: workout, replayed } = await logWorkout(workoutInput, userId, request());
    expect(replayed).toBe(false);

    // 1. Verify workout was created
    expect(workout.id).toBeDefined();
    expect(workout.title).toBe("Morning Lift");
    expect(workout.xpEarned).toBeGreaterThan(0);

    // 2. Verify user stats were updated
    const usersCol = await getCollection<UserDoc>("user");
    const user = await usersCol.findOne({ _id: new ObjectId(userId) });

    expect(user).toBeDefined();
    expect(user!.totalWorkouts).toBe(1); // incremented
    expect(user!.xp).toBe(workout.xpEarned); // XP granted
    expect(user!.streak).toBe(1); // Streak started
  });

  it("emits activity.logged with the workout", async () => {
    const { value: workout } = await logWorkout(
      { title: "Evented", duration: 30, exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 100 }] },
      userId,
      request()
    );

    const rows = await (await getCollection("outbox")).find({ type: "activity.logged" }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ userId, activity: { type: "workout", id: workout.id } });
    expect(rows[0].payload.occurredAt).toBeInstanceOf(Date);
  });

  it("a replay emits nothing more", async () => {
    const req = request();
    const input = { title: "Once", duration: 30, exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 100 }] };

    await logWorkout(input, userId, req);
    await logWorkout(input, userId, req);

    expect(await (await getCollection("outbox")).countDocuments({ type: "activity.logged" })).toBe(1);
  });

  it("extends the streak on the user's local day", async () => {
    const usersCol = await getCollection<UserDoc>("user");
    await usersCol.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { timeZone: "Asia/Manila", streak: 3, lastActivityDate: new Date("2026-10-20T00:00:00Z") } }
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T23:30:00Z"));

    await logWorkout({
      title: "Late Lift",
      duration: 30,
      exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 100 }]
    }, userId, request());

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    expect(user!.streak).toBe(4);
    expect(user!.lastActivityDate!.toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("applies two concurrent workouts without losing either update", async () => {
    const usersCol = await getCollection<UserDoc>("user");
    await usersCol.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { totalWorkouts: 0, xp: 0, level: 1, xpToNextLevel: 500, stamina: 100, lastStaminaUpdate: new Date() } }
    );
    const input = {
      title: "Parallel",
      duration: 30,
      exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 100 }],
    };

    const [first, second] = await Promise.all([
      logWorkout(input, userId, request()),
      logWorkout(input, userId, request()),
    ]);

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    expect(user!.totalWorkouts).toBe(2);
    expect(user!.xp).toBe(first.value.xpEarned + second.value.xpEarned);
    // 30 min -> 10 + 6 = 16 stamina per workout
    expect(user!.stamina).toBe(100 - 2 * 16);
  });

  describe('idempotency', () => {
    const idempotentInput = {
      title: "Evening Run",
      duration: 30,
      exercises: [{ name: "Jogging", targetMuscle: TargetMuscle.Cardio, sets: 1, reps: 1, weight: null }],
    };

    async function readUser() {
      const usersCol = await getCollection<UserDoc>("user");
      return (await usersCol.findOne({ _id: new ObjectId(userId) }))!;
    }

    it('replays the existing workout on a duplicate request without re-applying side effects', async () => {
      const req = request();
      const first = await logWorkout(idempotentInput, userId, req);
      const afterFirst = await readUser();

      const second = await logWorkout(idempotentInput, userId, req);

      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);
      expect(second.value.id).toBe(first.value.id);
      const afterSecond = await readUser();
      expect(afterSecond.xp).toBe(afterFirst.xp);
      expect(afterSecond.totalWorkouts).toBe(afterFirst.totalWorkouts);
      const workoutsCol = await getCollection("workouts");
      expect(await workoutsCol.countDocuments({ userId, idempotencyKey: req.key })).toBe(1);
    });

    it('stores the fingerprint on the workout', async () => {
      const req = request('fingerprint-abc');
      await logWorkout(idempotentInput, userId, req);

      const workoutsCol = await getCollection("workouts");
      const doc = await workoutsCol.findOne({ userId, idempotencyKey: req.key });
      expect(doc!.idempotencyFingerprint).toBe('fingerprint-abc');
    });

    it('rejects the same key with a different fingerprint with 422 and changes nothing', async () => {
      const key = crypto.randomUUID();
      await logWorkout(idempotentInput, userId, { key, fingerprint: 'f1' });
      const before = await readUser();

      const retry = logWorkout(idempotentInput, userId, { key, fingerprint: 'f2' });

      await expect(retry).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
      await expect(retry).rejects.toThrow(
        'This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.'
      );
      expect((await readUser()).xp).toBe(before.xp);
      const workoutsCol = await getCollection("workouts");
      expect(await workoutsCol.countDocuments({ userId, idempotencyKey: key })).toBe(1);
    });

    it('replays the edited workout after an update', async () => {
      const req = request();
      const first = await logWorkout(idempotentInput, userId, req);
      await updateWorkout(first.value.id, { ...idempotentInput, title: "Edited Title" }, userId);

      const replay = await logWorkout(idempotentInput, userId, req);

      expect(replay.replayed).toBe(true);
      expect(replay.value.title).toBe("Edited Title");
    });
  });

  describe('Stamina System Integration', () => {
    it('should correctly deduct stamina for a normal workout', async () => {
      // 1. Arrange: Update the dummy user to have 100 stamina
      const usersCol = await getCollection<UserDoc>("user");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 100, lastStaminaUpdate: new Date() } });

      const workoutInput = {
        title: "Normal Workout",
        duration: 60, // 60 min -> 10 + 12 = 22 cost
        exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 225 }]
      };

      // 2. Act
      await logWorkout(workoutInput, userId, request());

      // 3. Assert
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(78); // 100 - 22 = 78
    });

    it('should apply exhaustion debuff if stamina is 0', async () => {
      // 1. Arrange: Update the dummy user to have 0 stamina
      const usersCol = await getCollection<UserDoc>("user");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 0, lastStaminaUpdate: new Date() } });

      const workoutInput = {
        title: "Exhausted Workout",
        duration: 60, // Base XP: 60*2 + 1*15 = 135
        exercises: [{ name: "Running", targetMuscle: TargetMuscle.Cardio, sets: 1, reps: 1, weight: null }]
      };

      // 2. Act
      const { value: workout } = await logWorkout(workoutInput, userId, request());

      // 3. Assert
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(0); // Can't go below 0
      expect(workout.xpEarned).toBe(Math.round(135 * 0.5)); // 68
    });

    it('should process lazy recovery before applying cost', async () => {
      // 1. Arrange: Update the dummy user to have 10 stamina, updated 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      const usersCol = await getCollection<UserDoc>("user");
      await usersCol.updateOne({ _id: new ObjectId(userId) }, { $set: { stamina: 10, lastStaminaUpdate: twoDaysAgo } });

      const workoutInput = {
        title: "Recovered Workout",
        duration: 60, // 22 cost
        exercises: [{ name: "Squats", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 225 }]
      };

      // 2. Act
      await logWorkout(workoutInput, userId, request());

      // 3. Assert
      // Recovery: 10 + (2*100) = 210 -> 100
      // Cost: 100 - 22 = 78
      const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
      expect(userAfter!.stamina).toBe(78);
    });
  });
});
