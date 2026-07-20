/**
 * Health-check Route Handler.
 *
 * `POST /api/health` pings the backend's `GET /health` endpoint via the
 * internal API client. The response is the canonical way to verify the
 * frontend ↔ backend wiring in a running environment.
 *
 *   - `200 { status: "ok", backend: "reachable", latencyMs }` when the
 *     backend answered 2xx.
 *   - `503 { status: "error", backend: "unreachable", ... }` when the
 *     backend could not be reached, timed out, or returned a non-2xx.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, api } from '@/lib/api';

// Route Handlers run on demand — never prerender this endpoint.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  void request;
  const start = performance.now();
  try {
    await api.get<string>('/health', { skipAuth: true, timeout: 5_000 });
    const latencyMs = Math.round(performance.now() - start);
    return NextResponse.json({
      status: 'ok',
      backend: 'reachable',
      latencyMs,
    });
  } catch (cause) {
    const latencyMs = Math.round(performance.now() - start);
    if (cause instanceof ApiError) {
      return NextResponse.json(
        {
          status: 'error',
          backend: cause.isAbort ? 'unreachable' : 'error',
          latencyMs,
          error: {
            statusCode: cause.statusCode,
            error: cause.error,
            message: cause.message,
            requestId: cause.requestId || undefined,
            path: cause.path || undefined,
          },
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        status: 'error',
        backend: 'unknown',
        latencyMs,
        error: {
          message: cause instanceof Error ? cause.message : 'Unknown error',
        },
      },
      { status: 503 },
    );
  }
}
