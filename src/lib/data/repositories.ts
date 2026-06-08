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
  mockAchievements,
} from "@/lib/mock-data";

import type {
  User,
  Workout,
  Run,
  Quest,
  Achievement,
  DashboardStats,
  CreateWorkoutInput,
  CreateRunInput,
} from "@/lib/types";

export async function getUser(): Promise<User> {
  const res = await fetch("/api/user");
  if (!res.ok) {
    throw new Error("Failed to fetch user");
  }
  return res.json();
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
  const result = await res.json();
  window.dispatchEvent(new Event("user-updated"));
  return result;
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

export async function updateWorkout(
  id: string,
  input: CreateWorkoutInput
): Promise<Workout> {
  const res = await fetch(`/api/workouts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to update workout"
    );
  }
  const result = await res.json();
  window.dispatchEvent(new Event("user-updated"));
  return result;
}

export async function getRuns(): Promise<readonly Run[]> {
  const res = await fetch("/api/runs");
  if (!res.ok) {
    throw new Error("Failed to fetch runs");
  }
  return res.json();
}

export async function createRun(
  input: CreateRunInput
): Promise<Run> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to create run"
    );
  }
  const result = await res.json();
  window.dispatchEvent(new Event("user-updated"));
  return result;
}

export async function deleteRun(id: string): Promise<boolean> {
  const res = await fetch(`/api/runs/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to delete run"
    );
  }
  return true;
}

export async function updateRun(
  id: string,
  input: CreateRunInput
): Promise<Run> {
  const res = await fetch(`/api/runs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to update run"
    );
  }
  const result = await res.json();
  window.dispatchEvent(new Event("user-updated"));
  return result;
}

export async function getQuests(): Promise<readonly Quest[]> {
  const res = await fetch("/api/quests");
  if (!res.ok) {
    throw new Error("Failed to fetch quests");
  }
  return res.json();
}

export function getAchievements(): readonly Achievement[] {
  return mockAchievements;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/stats/dashboard");
  if (!res.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }
  return res.json();
}

export async function claimQuest(
  id: string,
): Promise<void> {
  const res = await fetch(`/api/quests/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to  claim quest"
    );
  }
  const result = await res.json();
  window.dispatchEvent(new Event("user-updated"));
  return result;
}

