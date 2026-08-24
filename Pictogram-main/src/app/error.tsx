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
      <p className="text-lg font-bold">Something broke</p>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl2 bg-red-500/10 p-3 text-left text-xs text-red-500">
        {error.message}
        {error.stack ? `\n\n${error.stack}` : ""}
      </pre>
      <button onClick={reset} className="rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
