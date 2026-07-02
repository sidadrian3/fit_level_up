export default function DashboardLoading() {
    return (
        <div className="space-y-6 pb-12 animate-pulse">
            <div className="h-24 bg-card rounded-xl w-full"></div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="h-64 bg-card rounded-xl border border-border"></div>
                
                <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                </div>
            </div>
            
            <div className="h-48 bg-card rounded-xl border border-border w-full"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="h-80 bg-card rounded-xl border border-border"></div>
                <div className="h-80 bg-card rounded-xl border border-border"></div>
            </div>
        </div>
    );
}
