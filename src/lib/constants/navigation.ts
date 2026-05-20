import {
  LayoutDashboard,
  Dumbbell,
  Footprints,
  Scroll,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Navigation links — shared between Sidebar and BottomTabs */
export const navLinks: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/runs", label: "Running", icon: Footprints },
  { href: "/quests", label: "Quests", icon: Scroll },
  { href: "/profile", label: "Profile", icon: UserCircle },
];
