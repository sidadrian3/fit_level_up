import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/workouts', '/runs', '/quests', '/profile']
const publicAuthRoutes = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route))
  const isPublicAuthRoute = publicAuthRoutes.includes(path)

  const sessionToken = request.cookies.get('better-auth.session_token')

  if (isProtectedRoute && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// Routes Proxy should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
