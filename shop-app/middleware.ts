import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verify } from '@/lib/session';

// Inventory Clerks may only reach these paths (NFR-002). Everything else is
// owner/admin. Database RPCs re-check the role, so this is defence in depth.
const CLERK_ALLOWED = ['/inventory', '/settings'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const session = await verify(req.cookies.get(COOKIE)?.value);

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (session.role === 'clerk') {
    const ok = CLERK_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (!ok) {
      if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      return NextResponse.redirect(new URL('/inventory', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/inventory/:path*', '/stock/:path*', '/jobs/:path*',
    '/catalog/:path*', '/suppliers/:path*', '/audit/:path*', '/reports/:path*',
    '/users/:path*', '/settings/:path*', '/api/reports/:path*',
  ],
};
