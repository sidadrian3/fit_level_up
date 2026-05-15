"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Footprints,
  Scroll,
  UserCircle,
  Flame,
} from "lucide-react";
import { mockUser } from "@/lib/mock-data";

// Navigation links — each maps to a route
const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/runs", label: "Running", icon: Footprints },
  { href: "/quests", label: "Quests", icon: Scroll },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function Sidebar() {
  // usePathname() gives us the current URL path so we can highlight the active link
  const pathname = usePathname();

  // Calculate XP progress percentage for the mini XP bar
  const xpPercent = Math.round((mockUser.xp / mockUser.xpToNextLevel) * 100);

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border flex flex-col z-50">
      {/* ===== BRAND ===== */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-bold text-foreground">FitLevelUp</span>
        </Link>
      </div>

      {/* ===== USER MINI PROFILE ===== */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-lg">
            {mockUser.avatar}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              {mockUser.name}
            </p>
            <p className="text-xs text-muted">Level {mockUser.level}</p>
          </div>
        </div>

        {/* Mini XP bar */}
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-green rounded-full transition-all duration-500"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-1">
          {mockUser.xp} / {mockUser.xpToNextLevel} XP
        </p>
      </div>

      {/* ===== NAVIGATION LINKS ===== */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navLinks.map((link) => {
            // Check if this link matches the current page
            const isActive = pathname === link.href;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                    transition-default
                    ${
                      isActive
                        ? "bg-accent-green/10 text-accent-green"
                        : "text-muted hover:text-foreground hover:bg-card-hover"
                    }
                  `}
                >
                  <link.icon size={20} />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ===== STREAK CARD ===== */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent-orange/10">
          <Flame size={20} className="text-accent-orange" />
          <div>
            <p className="text-sm font-semibold text-accent-orange">
              {mockUser.streak}-day streak
            </p>
            <p className="text-xs text-muted">Keep it going!</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
