import { PageHeader } from "@/components/layout/PageHeader";

export default function FriendsLoading() {
  return (
    <div className="space-y-8 pb-12 animate-pulse">
      <PageHeader 
        title="Friends" 
        subtitle="Compete and train with your squad." 
      />

      {/* Tabs placeholder */}
      <div className="flex gap-2 p-1 bg-card border border-border rounded-xl w-fit">
        <div className="h-10 w-24 bg-border rounded-lg"></div>
        <div className="h-10 w-24 bg-border rounded-lg"></div>
        <div className="h-10 w-32 bg-border rounded-lg"></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-24 bg-card rounded-2xl border border-border"></div>
        <div className="h-24 bg-card rounded-2xl border border-border"></div>
        <div className="h-24 bg-card rounded-2xl border border-border"></div>
      </div>
    </div>
  );
}
