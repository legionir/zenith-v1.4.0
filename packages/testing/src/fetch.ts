import { createMockServer, rest, respond, installFetchMock } from '@zenith/mock';
import { onGlobalReset, deprecate } from '@zenith/errors';

/** @public */
export interface MockHttpCall {
  url: string;
  init: RequestInit;
}

/** @public */
export interface MockHttpController {
  calls: MockHttpCall[];
  restore: () => void;
  dispose: () => void;
}

/**
 * #137: شبیه‌ساز درخواست‌های `fetch` برای تست‌های بدون شبکه (مانند `zen-fetch` و `@zenith/http`).
 * @public
 */
export function mockFetch(
  handler: (
    url: string,
    init: RequestInit,
  ) =>
    | Response
    | Promise<Response>
    | { status?: number; headers?: Record<string, string>; data?: unknown },
): MockHttpController {
  const calls: MockHttpCall[] = [];
  const requests = new WeakMap<Request, MockHttpCall>();
  const server = createMockServer([rest.all('*', async ({ request }) => {
    const call = requests.get(request)!;
    const res = await handler(call.url, call.init);
    if (res instanceof Response) return res;
    return respond({ status: res?.status ?? 200, headers: { 'Content-Type': 'application/json', ...(res?.headers ?? {}) }, json: res && 'data' in res ? res.data : res ?? {} });
  })]);
  const release = installFetchMock(server, { onRequest(request, input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const call = { url, init: init ?? {} }; calls.push(call); requests.set(request, call);
  } });
  let restored = false; let detachReset = () => {};
  const restore = () => { if (restored) return; restored = true; detachReset(); release(); server.close(); };
  detachReset = onGlobalReset(restore);
  return { calls, restore, dispose: restore };
}

/**
 * @deprecated #119 — نام `mockHttp` با `@zenith/http.mockHttp` (mock خط لولهٔ
 * http) هم‌نام و مبهم بود؛ این تابع `globalThis.fetch` را در تست‌ها patch
 * می‌کند. از `mockFetch` استفاده کنید (ZEN-DEPR-051؛ حذف در ۲.۰).
 * @public
 */
export function mockHttp(handler: Parameters<typeof mockFetch>[0]): MockHttpController {
  deprecate('ZEN-DEPR-051', 'mockHttp (@zenith/testing)', 'mockFetch');
  return mockFetch(handler);
}
