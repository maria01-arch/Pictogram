import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone may open without an account. Google Play requires the privacy
// policy, terms and an account-deletion page to be publicly reachable.
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/privacy-policy",
  "/terms",
  "/delete-account",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // API routes are excluded — they should return their own JSON error
  // responses (e.g. 401) rather than being redirected to an HTML login
  // page, which silently broke fetch() calls expecting JSON (like this
  // one) and made unauthenticated testing tools like curl unusable.
  //
  // Also skipped (must be reachable WITHOUT being logged in, otherwise the
  // browser/Play Store gets a login page instead of the file):
  //   manifest.json, /.well-known/* (Android app-link verification),
  //   OneSignal service-worker files, robots.txt, images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|manifest\\.json|\\.well-known|OneSignalSDK[^/]*\\.js|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
