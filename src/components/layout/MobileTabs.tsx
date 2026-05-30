"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/constants/navigation";

export function MobileTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex lg:hidden items-center justify-around px-2 z-50 pb-safe">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              flex flex-col items-center justify-center gap-1 w-full h-full
              transition-default
              ${
                isActive
                  ? "text-accent-green"
                  : "text-muted hover:text-foreground"
              }
            `}
          >
            <Icon size={24} className={isActive ? "scale-110" : "scale-100"} />
            <span className="text-[10px] font-medium">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
