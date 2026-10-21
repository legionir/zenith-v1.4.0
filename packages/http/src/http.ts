/**
 * @zenith/http - Advanced HTTP integration for Zenith
 *
 * Features:
 *   - Request/response interceptors
 *   - Smart retry with exponential backoff
 *   - Response caching (memory + TTL) — از #144 روی @zenith/cache
 *   - Request timeout & cancellation
 *   - Centralized error handling
 */

// #40: این فایل حالا فقط barrel است؛ پیاده‌سازی در ماژول‌های هم‌نام
// (سطح عمومی عین قبل — index.ts همان نام‌ها را می‌گیرد).
export * from './http-types';
export * from './http-options';
export * from './http-state';
export * from './http-config';
export * from './http-request';

// ============================================================
// #154 — Realtime Transport (createRealtime, createWebSocket, createSSE)
// ============================================================

/** @deprecated Use @zenith/realtime; compatibility strings/testing bridge preserved. */
export { createRealtime, createWebSocket, createSSE } from '@zenith/realtime/legacy';
export type { RealtimeStatus, RealtimeOptions, RealtimeClient } from '@zenith/realtime/legacy';
