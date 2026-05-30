import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabs } from "@/components/layout/MobileTabs";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar — fixed left navigation on desktop */}
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop, padded for bottom tabs on mobile */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 mb-20 lg:mb-0 w-full overflow-x-hidden">
        {children}
      </main>
      
      {/* Mobile Tabs — fixed bottom navigation on mobile */}
      <MobileTabs />
    </div>
  );
}
