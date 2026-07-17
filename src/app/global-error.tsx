"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontWeight: "bold", fontSize: 18 }}>Something broke</p>
          <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", fontSize: 12, color: "red", overflowX: "auto" }}>
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 20px", borderRadius: 999 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
