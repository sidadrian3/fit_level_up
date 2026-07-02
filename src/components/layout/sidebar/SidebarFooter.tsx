"use client";

import { Flame } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import type { User } from "@/lib/types";

export function SidebarFooter({ user }: { user: User }) {
  return (
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
  );
}
