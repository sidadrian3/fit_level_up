"use client";

import { useUser } from "@/lib/context/UserContext";
import { SidebarBrand } from "./sidebar/SidebarBrand";
import { SidebarUserProfile } from "./sidebar/SidebarUserProfile";
import { SidebarNav } from "./sidebar/SidebarNav";
import { SidebarFooter } from "./sidebar/SidebarFooter";

export function Sidebar() {
  const { user } = useUser();

  if (!user) {
    return (
      <aside className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border hidden lg:flex flex-col z-50 p-6">
        <div className="animate-pulse bg-border h-8 w-32 rounded mb-10"></div>
        <div className="animate-pulse bg-border h-10 w-full rounded mb-6"></div>
      </aside>
    );
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-card border-r border-border hidden lg:flex flex-col z-50">
      <SidebarBrand />
      <SidebarUserProfile user={user} />
      <SidebarNav />
      <SidebarFooter user={user} />
    </aside>
  );
}
