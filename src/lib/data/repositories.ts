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
  mockWorkouts,
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
} from "@/lib/types";

export function getUser(): User {
  return mockUser;
}

export function getWorkouts(): readonly Workout[] {
  return mockWorkouts;
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
