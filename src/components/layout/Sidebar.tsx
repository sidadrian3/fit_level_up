"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { getUser } from "@/lib/data/repositories";
import type { User } from "@/lib/types";
import { useEffect, useState } from "react";
import { navLinks } from "@/lib/constants/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await getUser();
        setUser(data);
      } catch (err) {
        console.error("Failed to load user in sidebar", err);
      }
    }

    loadUser();

    // Listen for level up or user update events
    const handleUserUpdate = () => loadUser();
    window.addEventListener("user-updated", handleUserUpdate);
    return () => window.removeEventListener("user-updated", handleUserUpdate);
  }, []);

  if (!user) {
    return (
      <aside className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border hidden lg:flex flex-col z-50 p-6">
        <div className="animate-pulse bg-border h-8 w-32 rounded mb-10"></div>
        <div className="animate-pulse bg-border h-10 w-full rounded mb-6"></div>
      </aside>
    );
  }

  const xpPercent = Math.round((user.xp / user.xpToNextLevel) * 100);

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border hidden lg:flex flex-col z-50">
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
            {user.avatar}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              {user.name}
            </p>
            <p className="text-xs text-muted">Level {user.level}</p>
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
          {user.xp} / {user.xpToNextLevel} XP
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
              {user.streak}-day streak
            </p>
            <p className="text-xs text-muted">Keep it going!</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
