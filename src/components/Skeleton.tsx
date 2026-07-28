export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />;
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return <div className="animate-pulse rounded-full bg-black/10 dark:bg-white/10" style={{ width: size, height: size }} />;
}

export function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-black/5 dark:divide-white/5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <SkeletonCircle size={44} />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock className="h-3.5 w-24" />
            <SkeletonBlock className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex-1 space-y-3 px-3 py-2.5">
      {[false, true, false, false, true].map((mine, i) => (
        <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
          <SkeletonBlock className={`h-9 rounded-2xl ${mine ? "w-32" : "w-44"}`} />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center px-4 pt-6">
      <SkeletonCircle size={96} />
      <SkeletonBlock className="mt-3 h-4 w-32" />
      <SkeletonBlock className="mt-2 h-3 w-20" />
      <div className="mt-4 flex gap-2">
        <SkeletonBlock className="h-9 w-24 rounded-full" />
        <SkeletonBlock className="h-9 w-24 rounded-full" />
      </div>
      <div className="mt-8 grid w-full grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonBlock key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
      <SkeletonCircle size={40} />
      <SkeletonBlock className="h-3.5 w-32" />
    </div>
  );
}
