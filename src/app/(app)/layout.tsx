import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabs } from "@/components/layout/MobileTabs";
import { LevelUpManager } from "@/components/notifications/LevelUpManager";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { TimeZoneSync } from "@/components/auth/TimeZoneSync";
import { UserProvider } from "@/lib/context/UserContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar — fixed left navigation on desktop */}
        <Sidebar />
        {/* Main content area — offset by sidebar width on desktop, padded for bottom tabs on mobile */}
        <main className="flex-1 lg:ml-64 p-4 pt-16 lg:p-8 mb-20 lg:mb-0 w-full overflow-x-hidden">
          {children}
        </main>

        {/* Mobile Tabs — fixed bottom navigation on mobile */}
        <MobileTabs />

        {/* Global Toast Manager */}
        <LevelUpManager />
        <NotificationCenter />
        <TimeZoneSync />
      </div>
    </UserProvider>
  );
}
