import Link from "next/link";
import { Zap } from "lucide-react";

export function SidebarBrand() {
  return (
    <div className="p-6 border-b border-border">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Zap className="w-6 h-6 text-accent-green" />
        <span className="text-xl font-semibold tracking-tight text-foreground">FitLevelUp</span>
      </Link>
    </div>
  );
}
