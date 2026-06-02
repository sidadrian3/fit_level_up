/**
 * Data repository layer.
 *
 * This is the ONLY module that imports from mock-data.
 * All components receive data via props from page-level server components,
 * which call these repository functions.
 *
 * When you add a real API or database, swap the implementations here.
 * Every component stays untouched — that's Dependency Inversion in action.
 */

import {
  mockUser,
  mockRuns,
  mockQuests,
  mockAchievements,
  mockDashboardStats,
} from "@/lib/mock-data";

import type {
  User,
  Workout,
  Run,
  Quest,
  Achievement,
  DashboardStats,
  CreateWorkoutInput,
} from "@/lib/types";

export function getUser(): User {
  return mockUser;
}

export async function getWorkouts(): Promise<readonly Workout[]> {
  const res = await fetch("/api/workouts");
  if (!res.ok) {
    throw new Error("Failed to fetch workouts");
  }
  return res.json();
}

export async function createWorkout(
  input: CreateWorkoutInput
): Promise<Workout> {
  const res = await fetch("/api/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to create workout"
    );
  }
  return res.json();
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const res = await fetch(`/api/workouts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to delete workout"
    );
  }
  return true;
}

export function getRuns(): readonly Run[] {
  return mockRuns;
}

export function getQuests(): readonly Quest[] {
  return mockQuests;
}

export function getAchievements(): readonly Achievement[] {
  return mockAchievements;
}

export function getDashboardStats(): DashboardStats {
  return mockDashboardStats;
}
