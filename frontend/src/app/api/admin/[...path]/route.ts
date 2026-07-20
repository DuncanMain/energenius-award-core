import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { previewResponse } from './preview';

const coreUrl =
  process.env.CORE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/v1';

async function proxy(request: NextRequest, path: string[]) {
  const token = cookies().get('eg_admin_token')?.value;
  if (!token)
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  if (process.env.ADMIN_PREVIEW_MODE === 'true' && token === 'local-preview')
    return NextResponse.json(previewResponse(path.join('/'), request.method));
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin)
      return NextResponse.json({ message: 'Origin rejected' }, { status: 403 });
  }
  const target = `${coreUrl.replace(/\/$/, '')}/admin/${path.join('/')}${request.nextUrl.search}`;
  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.text();
  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body
        ? {
            'content-type':
              request.headers.get('content-type') || 'application/json',
          }
        : {}),
      ...(request.headers.get('x-admin-confirmation')
        ? {
            'x-admin-confirmation': request.headers.get(
              'x-admin-confirmation'
            )!,
          }
        : {}),
    },
    body,
    cache: 'no-store',
  });
  const text = await upstream.text();
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') || 'application/json',
    },
  });
}

type Context = { params: { path: string[] } };
export const GET = (request: NextRequest, context: Context) =>
  proxy(request, context.params.path);
export const POST = (request: NextRequest, context: Context) =>
  proxy(request, context.params.path);
export const PATCH = (request: NextRequest, context: Context) =>
  proxy(request, context.params.path);
