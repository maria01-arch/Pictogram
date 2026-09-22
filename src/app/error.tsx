"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-bold">Something went wrong</p>
      <p className="max-w-xs text-sm text-ink-muted">
        Please try again. If it keeps happening, restart the app or contact support@xchord.space.
      </p>
      {/* Technical details are for you (the developer) only — never shown to users. */}
      {process.env.NODE_ENV === "development" && (
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl2 bg-red-500/10 p-3 text-left text-xs text-red-500">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      )}
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white">
          Try again
        </button>
        <a href="/" className="rounded-full bg-black/5 px-5 py-2 text-sm font-semibold dark:bg-white/10">
          Go home
        </a>
      </div>
    </div>
  );
}
