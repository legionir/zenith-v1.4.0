export interface SSRResult {
    html: string;
    state: string;
    route?: string;
}
/**
 * Thread-safe render: DOM globals در AsyncLocalStorage ذخیره می‌شوند.
 * هر درخواست concurrent ایزوله است.
 *
 * Bug Fix: routeSignal نیز با runWithRoute() ایزوله می‌شود.
 * قبلاً routeSignal یک singleton ماژول-level بود و در SSR concurrent
 * باعث race condition می‌شد. حالا هر درخواست context مستقل خود را دارد.
 */
export declare function renderToString(html: string, state: Record<string, any>, options?: {
    route?: string;
    serializeState?: boolean;
}): Promise<SSRResult>;
export declare function generateHydrationScript(result: SSRResult, nonce?: string): string;
export declare function generateFullPage(result: SSRResult, head?: string, nonce?: string): string;
export interface StreamChunk {
    html: string;
    done: boolean;
}
/**
 * Stream SSR: HTML را به chunks تقسیم می‌کند.
 *
 * 1. Head + opening tags فوراً stream می‌شوند.
 * 2. State script در head قرار می‌گیرد.
 * 3. Body content بعد از render stream می‌شود.
 * 4. Closing tags آخرین chunk هستند.
 *
 * استفاده:
 *   const stream = renderToStream(html, state, { route: '/' });
 *   for await (const chunk of stream) {
 *     res.write(chunk.html);
 *   }
 *   res.end();
 */
export declare function renderToStream(html: string, state: Record<string, any>, options?: {
    route?: string;
    head?: string;
}): AsyncGenerator<StreamChunk>;
//# sourceMappingURL=render.d.ts.map