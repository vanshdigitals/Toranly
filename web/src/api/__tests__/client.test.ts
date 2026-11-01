import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../client';

function problem(status: number, body: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiRequest', () => {
  it('sends JSON to /api/v1 with the device cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/plan/summary', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/plan/summary');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('parses Problem Details and Retry-After into ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          problem(
            503,
            { code: 'ai_busy', title: 'AI busy', detail: 'Try again soon.' },
            { 'Retry-After': '20' },
          ),
        ),
    );

    const err = await apiRequest('/ai/suggest', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 503,
      code: 'ai_busy',
      title: 'AI busy',
      detail: 'Try again soon.',
      retryAfter: 20,
    });
  });

  it('reports an unreachable backend as status 0 and retries GET once', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await apiRequest('/ai/status').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isUnreachable).toBe(true);
    expect(err.code).toBe('network');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries POST', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/ai/suggest', { method: 'POST', body: {} }).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out with code "timeout"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            ),
          ),
      ),
    );

    const err = await apiRequest('/plan/validate', {
      method: 'POST',
      body: {},
      timeoutMs: 10,
    }).catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'timeout' });
  });
});
