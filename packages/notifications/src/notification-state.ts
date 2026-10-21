// packages/notifications/src/notification-state.ts
//
// state داخلی مرکز اعلان‌ها — استخراج مکانیکی از notifications.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { signal } from '@zenith/state';
import { DEFAULTS, type AlertOptions, type ConfirmOptions, type Notification, type NotifyOptions } from './notification-types';


// ============================================================
// Internal State
// ============================================================

export const notifications = signal<Notification[]>([]);
export const queuedNotifications = signal<Notification[]>([]);
export const activeAlerts = signal<Array<{ id: string; options: AlertOptions; resolve: () => void }>>([]);
export const activeConfirms = signal<
  Array<{ id: string; options: ConfirmOptions; resolve: (value: boolean) => void }>
>([]);

let nextId = 1;
export const generateId = () => `notif_${nextId++}_${Date.now().toString(36)}`;

// Default configuration — از DEFAULTS ساخته می‌شود تا دو منبع حقیقت نداشته باشیم.
export let defaultOptions: NotifyOptions = { ...DEFAULTS };

/** وضعیت هر تایمر auto-dismiss (برای pause/resume — #132). */
export interface TimerState {
  handle: ReturnType<typeof setTimeout> | null;
  /** میلی‌ثانیهٔ باقی‌ماندهٔ زمان‌بندی‌شده. */
  remaining: number;
  startedAt: number;
  /** #132: تایمر روی hover/focus متوقف شده است. */
  paused: boolean;
}
export const dismissTimers = new Map<string, TimerState>();

/**
 * #132: سقف نمایش مؤثرِ آخرین `notify` — هنگام خالی‌شدن یک جایگاه، صف با همین
 * سقف تخلیه می‌شود (پیش‌تر `defaultOptions` خوانده می‌شد و `maxVisible` هر
 * فراخوانی نادیده می‌ماند).
 */
export let currentMaxVisible: number = DEFAULTS.maxVisible;

// ============================================================
// Configuration
// ============================================================

/**
 * Set default options for all notifications
 */
/** @public */
export function setNotificationDefaults(options: Partial<NotifyOptions>): void {
  defaultOptions = { ...defaultOptions, ...options };
}

/**
 * Get current default notification options
 */
/** @public */
export function getNotificationDefaults(): NotifyOptions {
  return { ...defaultOptions };
}

/** #132: دیالوگ‌های DOMِ باز (برای آزادسازی در ریست سراسری). */
export const openDialogs = new Set<{ dispose(): void }>();
// ── #40: mutation helpers ──
//
// defaultOptions/currentMaxVisible/nextId در اصل letهای همین ماژول بودند و
// از ماژولهای دیگر (notify/reset) بازنویسی میشدند. چون rebinding روی live
// binding وارداتی ESM ممنوع است، بازنویسی فقط از همینجا انجام میشود.
// رفتار عین قبل است.
/** جایگزینی سقف نمایش مؤثر (فراخوانی از notify). */
export function setCurrentMaxVisible(n: number): void {
  currentMaxVisible = n;
}
/** جایگزینی کامل پیشفرضها (فراخوانی از ریست سراسری). */
export function replaceDefaultOptions(next: NotifyOptions): void {
  defaultOptions = next;
}
/** بازنشانی شمارنده شناسه (فراخوانی از ریست سراسری). */
export function resetToastId(): void {
  nextId = 1;
}
