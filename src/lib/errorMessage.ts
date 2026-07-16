// Supabase's Postgrest/Storage errors are often plain objects with a
// `.message` string, not real Error instances — so `err instanceof Error`
// silently misses them. This checks both shapes.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Something went wrong. Try again.";
}
