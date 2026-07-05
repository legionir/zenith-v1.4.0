// packages/crud/dist/crud-engine.d.ts
//
// FEATURE (v0.3.0): HTML CRUD Engine — type declarations.
//
// (Generated from src/crud-engine.ts.)

import type { Signal, Computed } from '@zenith/state';
import type { Resource } from '@zenith/resource';

/**
 * پیکربندی یک CRUD Engine.
 */
export interface CrudEngineConfig {
  /** نام Resource ثبت‌شده (از createResource). */
  resource: string;
  /** ستون‌های جدول. */
  columns: Array<{ field: string; label?: string; sortable?: boolean }>;
  /** فیلدهای قابل‌جستجو. پیش‌فرض: همه‌ی فیلدهای columns. */
  searchFields?: string[];
  /** فیلترهای قابل‌اعمال. */
  filters?: Array<{
    field: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
  }>;
  /** اندازه‌ی صفحه. پیش‌فرض: 10. */
  pageSize?: number;
  /** آیا search box نمایش داده شود؟ پیش‌فرض: true. */
  searchable?: boolean;
  /** Actions سفارشی در هر ردیف. */
  rowActions?: Array<{
    name: string;
    label: string;
    action: string;
    permission?: string;
    confirm?: boolean;
    danger?: boolean;
  }>;
  /** Actions سطح‌جدول (مثل "Add New"). */
  tableActions?: Array<{
    name: string;
    label: string;
    action: string;
    permission?: string;
  }>;
  /** permission required to see the table. */
  permission?: string;
}

/**
 * کلاس CrudEngine: موتور تولید جدول CRUD از روی یک Config.
 */
export declare class CrudEngine {
  constructor(config: CrudEngineConfig, host: HTMLElement);

  /**
   * رندر جدول CRUD در host element.
   * این متد SSR-safe است: در محیط Node.js no-op است.
   */
  render(): void;

  /**
   * پاکسازی کامل: dispose Effectها، حذف Actionهای دینامیک، پاکسازی DOM.
   */
  destroy(): void;
}

/**
 * پردازش دایرکتیو `zen-crud`.
 *
 * @param el         عنصری که zen-crud روی آن تعریف شده.
 * @param configAttr مقدار attribute: JSON string یا $variableName.
 * @param context    Context فعلی (شامل $<name> keys).
 * @returns تابع dispose برای پاکسازی.
 */
export declare function processCrud(
  el: HTMLElement,
  configAttr: string,
  context: Record<string, any>,
): () => void;
