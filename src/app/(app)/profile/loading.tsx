export default function ProfileLoading() {
    return (
        <div className="space-y-6 pb-12 animate-pulse">
            <div className="h-24 bg-card rounded-xl w-full"></div>
            
            <div className="h-48 bg-card rounded-xl border border-border w-full"></div>
            
            <div className="h-8 bg-card rounded w-1/4 mt-8 mb-6"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div className="h-40 bg-card rounded-xl border border-border"></div>
                <div className="h-40 bg-card rounded-xl border border-border"></div>
                <div className="h-40 bg-card rounded-xl border border-border"></div>
                <div className="h-40 bg-card rounded-xl border border-border"></div>
                <div className="h-40 bg-card rounded-xl border border-border"></div>
                <div className="h-40 bg-card rounded-xl border border-border"></div>
            </div>
        </div>
    );
}
