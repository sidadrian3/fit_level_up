"use client";

import { PageHeader } from "@/components/layout/PageHeader";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back, User"
        action={{ label: "+ Log Workout", onClick: () => { } }}
      />
    </div>
  );
}