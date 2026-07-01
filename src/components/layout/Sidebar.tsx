"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Zap } from "lucide-react";
import { navLinks } from "@/lib/constants/navigation";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/lib/context/UserContext";

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading, refresh } = useUser();

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
          <Zap className="w-6 h-6 text-accent-green" />
          <span className="text-xl font-semibold tracking-tight text-foreground">FitLevelUp</span>
        </Link>
      </div>

      {/* ===== USER MINI PROFILE ===== */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-lg overflow-hidden shrink-0">
            {user.avatar?.startsWith('http') ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : user.avatar === 'zap' ? (
              <Zap className="w-5 h-5 text-accent-purple" />
            ) : (
              user.avatar
            )}
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
                    ${isActive
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent-orange/10 mb-4">
          <Flame size={20} className="text-accent-orange" />
          <div>
            <p className="text-sm font-semibold text-accent-orange">
              {user.streak}-day streak
            </p>
            <p className="text-xs text-muted">Keep it going!</p>
          </div>
        </div>

        <button
          onClick={async () => {
            await authClient.signOut();
            window.location.href = "/login";
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
