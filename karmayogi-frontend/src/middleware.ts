import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes and their required roles
const protectedRoutes = {
  '/analytics': ['MANAGER', 'ADMIN'],
  '/team': ['MANAGER', 'ADMIN'],
  '/health': ['ADMIN'],
  '/admin': ['ADMIN'],
  '/admin/users': ['ADMIN'],
};

// Helper function to decode JWT token (simple base64 decode, no verification on client)
function decodeToken(token: string): { role?: string; userId?: string } | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Skip static files
  ) {
    return NextResponse.next();
  }

  // Get JWT token from cookies
  const token = request.cookies.get('jwt')?.value;

  // If no token and trying to access protected routes, redirect to login
  if (!token && !pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If token exists and trying to access auth pages, redirect to dashboard
  if (token && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Check role-based access for protected routes
  if (token) {
    const user = decodeToken(token);

    if (user) {
      // Check if current route requires specific roles
      for (const [route, requiredRoles] of Object.entries(protectedRoutes)) {
        if (pathname.startsWith(route)) {
          if (!requiredRoles.includes(user.role || '')) {
            // User doesn't have required role, redirect to dashboard
            console.warn(`Access denied: ${user.role} tried to access ${pathname}`);
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};