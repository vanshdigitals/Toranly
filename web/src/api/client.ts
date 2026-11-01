/**
 * The one HTTP client for the Toranly backend (same origin, /api/v1). Every server call goes
 * through `apiRequest`, so timeout, retry, cookie and error rules live here only.
 * Errors are RFC 9457 Problem Details from the backend, surfaced as `ApiError`.
 */

export const API_BASE = '/api/v1';

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response (offline, timeout, backend down). */
  readonly status: number;
  /** Problem Details `code` (for example `ai_busy`), or `network` / `timeout` / `unknown`. */
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  /** Seconds from the Retry-After header, when the server sent one. */
  readonly retryAfter: number | null;
  /** The whole Problem Details body, for extension members such as `layer`. */
  readonly problem: Record<string, unknown>;

  constructor(init: {
    status: number;
    code: string;
    title?: string;
    detail: string;
    retryAfter?: number | null;
    problem?: Record<string, unknown>;
  }) {
    super(init.detail);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title ?? '';
    this.detail = init.detail;
    this.retryAfter = init.retryAfter ?? null;
    this.problem = init.problem ?? {};
  }

  /** True when the backend could not be reached at all. */
  get isUnreachable(): boolean {
    return this.status === 0;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get('Retry-After'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: { code?: string; title?: string; detail?: string; [key: string]: unknown } = {};
  try {
    problem = (await response.json()) as typeof problem;
  } catch {
    // Not a Problem Details body (for example a proxy error page).
  }
  return new ApiError({
    status: response.status,
    code: problem.code ?? 'unknown',
    title: problem.title,
    detail: problem.detail ?? 'Something went wrong. Please try again.',
    retryAfter: retryAfterSeconds(response),
    problem,
  });
}

async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin', // the signed device cookie
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (signal?.aborted) throw err; // the caller cancelled; let it see the AbortError
    const timedOut = controller.signal.aborted;
    throw new ApiError({
      status: 0,
      code: timedOut ? 'timeout' : 'network',
      detail: timedOut
        ? 'The server took too long to answer.'
        : typeof navigator !== 'undefined' && !navigator.onLine
          ? "You're offline."
          : 'The server could not be reached.',
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Sends one request. GET requests are retried once when the backend could not be reached;
 * POST requests are never retried automatically (an AI call costs quota).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (err) {
    const retryable =
      (options.method ?? 'GET') === 'GET' && err instanceof ApiError && err.isUnreachable;
    if (!retryable || options.signal?.aborted) throw err;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return send<T>(path, options);
  }
}
