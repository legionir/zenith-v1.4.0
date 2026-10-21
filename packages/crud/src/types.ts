/** Declarative CRUD configuration. @public */
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
  /**
   * #15: آیا هنگام رندر اولیه داده به‌صورت خودکار واکشی شود؟ (پیش‌فرض: false)
   */
  autoFetch?: boolean;
  /**
   * #15: سقف تعداد تلاش مجدد در صورت خطای شبکه (پیش‌فرض: 3، سقف مطلق: 10).
   */
  maxRetries?: number;
}
