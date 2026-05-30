/**
 * Used by WorkoutCard, RecentActivity, and the WorkoutForm type selector.
 * Keeping this in one place avoids duplicate icon maps across components.
 */

import { Dumbbell, Activity, Flame, StretchHorizontal } from "lucide-react";
import type { Workout } from "@/lib/types";

export interface WorkoutTypeConfig {
  icon: typeof Dumbbell;
  color: string;
  bg: string;
  label: string;
}

export const workoutTypeConfig: Record<Workout["type"], WorkoutTypeConfig> = {
  strength: {
    icon: Dumbbell,
    color: "text-accent-orange",
    bg: "bg-accent-orange/10",
    label: "Strength",
  },
  cardio: {
    icon: Activity,
    color: "text-accent-blue",
    bg: "bg-accent-blue/10",
    label: "Cardio",
  },
  hiit: {
    icon: Flame,
    color: "text-accent-red",
    bg: "bg-accent-red/10",
    label: "HIIT",
  },
  flexibility: {
    icon: StretchHorizontal,
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
    label: "Flexibility",
  },
};
