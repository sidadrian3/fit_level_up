"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/constants/navigation";

export function SidebarNav() {
  const pathname = usePathname();

  return (
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
  );
}
