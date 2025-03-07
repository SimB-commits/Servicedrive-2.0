// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = req.nextUrl;

  // Lista över öppna rutter som inte kräver autentisering
  const openPaths = ['/api/auth', '/auth/login', '/auth/signup', '/auth/logout', '/public'];

  const isOpenPath = openPaths.some((path) => pathname.startsWith(path));

  if (isOpenPath) {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/protected/:path*', '/dashboard/:path*', '/arenden/:path*', '/kunder/:path*', '/nytt-arende/:path*', '/installningar/:path*', '/'],
};
