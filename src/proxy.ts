import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from "@/lib/auth"

const protectedRoutes = ['/dashboard', '/workouts', '/runs', '/quests', '/profile']
const publicAuthRoutes = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicAuthRoute = publicAuthRoutes.includes(path)

  // Try to get session to determine auth state
  // Using try-catch because DB connection might fail
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: request.headers
    });
  } catch (error) {
    console.error("Auth session check failed in proxy:", error);
  }

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// Routes Proxy should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
