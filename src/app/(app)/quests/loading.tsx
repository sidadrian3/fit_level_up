export default function QuestsLoading() {
    return (
        <div className="space-y-6 pb-12 animate-pulse">
            <div className="h-24 bg-card rounded-xl w-full"></div>
            
            <div className="h-8 bg-card rounded w-1/4 mt-8 mb-6"></div>
            
            <div className="space-y-4">
                <div className="h-32 bg-card rounded-xl border border-border"></div>
                <div className="h-32 bg-card rounded-xl border border-border"></div>
                <div className="h-32 bg-card rounded-xl border border-border"></div>
                <div className="h-32 bg-card rounded-xl border border-border"></div>
            </div>
        </div>
    );
}
