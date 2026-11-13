import { NextRequest, NextResponse } from 'next/server';
import { checkBasicAuth } from './lib/basic-auth';

export async function proxy(request: NextRequest) {
  const result = await checkBasicAuth(request.headers.get('authorization'));

  if (result === 'ok') {
    return NextResponse.next();
  }

  if (result === 'not_configured') {
    return new NextResponse('Admin authentication is not configured', { status: 503 });
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Mikiri Admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|legal/).*)'],
};
