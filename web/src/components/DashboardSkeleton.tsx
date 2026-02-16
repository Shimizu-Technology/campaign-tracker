function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/8 ${className || ''}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[ 0, 1, 2, 3 ].map(i => (
          <div key={i} className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-3">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-8 w-16" />
            <Pulse className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-8">
        <div className="flex justify-between mb-3">
          <Pulse className="h-4 w-36" />
          <Pulse className="h-4 w-20" />
        </div>
        <Pulse className="h-4 w-full" />
      </div>

      {/* Village Grid */}
      <Pulse className="h-7 w-48 mb-4" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <Pulse className="h-4 w-28" />
              <Pulse className="h-4 w-14" />
            </div>
            <div className="flex justify-between">
              <Pulse className="h-3 w-16" />
              <Pulse className="h-3 w-8" />
            </div>
            <Pulse className="h-2.5 w-full" />
            <Pulse className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
