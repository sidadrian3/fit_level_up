export default function WorkoutsLoading() {
    return (
        <div className="space-y-6 pb-12 animate-pulse">
            <div className="h-24 bg-card rounded-xl w-full"></div>
            
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <div className="xl:col-span-3 h-[500px] bg-card rounded-xl border border-border"></div>
                
                <div className="xl:col-span-2 space-y-4">
                    <div className="h-8 bg-card rounded w-1/3 mb-6"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                    <div className="h-32 bg-card rounded-xl border border-border"></div>
                </div>
            </div>
        </div>
    );
}
