import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { previewResponse } from './preview';

const coreUrl =
  process.env.CORE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000/v1';

function isSameRequestHost(request: NextRequest, origin: string) {
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = request.headers
      .get('x-forwarded-host')
      ?.split(',', 1)[0]
      .trim()
      .toLowerCase();
    const requestHost = request.headers.get('host')?.trim().toLowerCase();

    // nextUrl can contain the container's internal host behind a reverse proxy.
    // Compare with the public forwarded host first, while retaining Host as a
    // fallback for direct/local deployments.
    return originHost === forwardedHost || originHost === requestHost;
  } catch {
    return false;
  }
}

async function proxy(request: NextRequest, path: string[]) {
  const token = cookies().get('eg_admin_token')?.value;
  if (!token)
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  // Keep the proxy scoped to /admin/*: reject traversal segments so an encoded `..` can't
  // escape the prefix and reach other core endpoints under the admin's token.
  if (path.some(segment => segment === '..' || segment.includes('..')))
    return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
  if (process.env.ADMIN_PREVIEW_MODE === 'true' && token === 'local-preview')
    return NextResponse.json(previewResponse(path.join('/'), request.method));
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && !isSameRequestHost(request, origin))
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
