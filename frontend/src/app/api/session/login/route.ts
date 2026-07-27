import { NextRequest, NextResponse } from 'next/server';

const nexusUrl =
  process.env.NEXUS_API_URL ||
  process.env.NEXT_PUBLIC_NEXUS_API_URL ||
  'https://energenius-nexus.zentrix.io';
const coreUrl =
  process.env.CORE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/v1';

export async function POST(request: NextRequest) {
  if (process.env.ADMIN_PREVIEW_MODE === 'true') {
    const response = NextResponse.json({ preview: true });
    response.cookies.set('eg_admin_token', 'local-preview', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  }
  const body = await request.json();
  const login = await fetch(`${nexusUrl.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });
  const payload = await login.json().catch(() => ({}));
  const token = payload.access_token || payload.data?.access_token;
  if (!login.ok || !token)
    return NextResponse.json(
      { message: payload.message || payload.error || 'Nexus login failed' },
      { status: login.status || 401 }
    );

  const admin = await fetch(`${coreUrl.replace(/\/$/, '')}/admin/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const adminPayload = await admin.json().catch(() => ({}));
  if (!admin.ok)
    return NextResponse.json(
      {
        message:
          adminPayload.message ||
          'This Nexus account is not an enabled administrator',
      },
      { status: admin.status }
    );

  const response = NextResponse.json(adminPayload);
  response.cookies.set('eg_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return response;
}
