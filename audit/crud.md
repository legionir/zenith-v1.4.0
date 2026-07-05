# گزارش حسابرسی پکیج `crud`
**نسخه:** v1.3.0 | **بسته:** `@zenith/crud`

---

## ۱. خلاصه پکیج

پکیج `crud` عملیات CRUD (ایجاد، خواندن، به‌روزرسانی، حذف) سطح بالایی را برای فریم‌ورک Zenith فراهم می‌کند. این پکیج اکشن‌های CRUD (crudList, crudCreate, crudUpdate, crudDelete, crudRefresh) را ثبت می‌کند، از optimistic delete با snapshot rollback و به‌روزرسانی لیست پس از حذف (v1.2.7) پشتیبانی می‌کند و از `zen-crud-*` attributes در HTML استفاده می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/crud.ts` | ~۲۰۰+ | CRUD actions, FormData collection, optimistic delete |

---

## ۳. باگ‌ها و مشکلات

### BUG-CRD-01: `crudDelete` optimistic rollback در صورت خطا در حذف با snapshot قدیمی
- **شدت:** بالا
- **محل:** `src/crud.ts`
- **شرح:** optimistic delete با snapshot کار می‌کند. اگر داده‌ها بین حذف و rollback تغییر کنند، snapshot قدیمی را بازیابی می‌کند و تغییرات را از دست می‌دهد.
- **نحوه رفع:** merge به جای replace:

```typescript
function rollbackWithMerge(originalList: any[], snapshot: any[]): any[] {
  // ترکیب snapshot با تغییرات بعدی (در صورت وجود)
  const deletedItems = snapshot.filter(s => !originalList.includes(s));
  const currentItems = originalList.filter(o => !snapshot.includes(o));
  // بازگرداندن آیتم‌های حذف‌شده + حفظ آیتم‌های جدید
  return [...snapshot, ...currentItems].filter(
    (item, index, arr) => arr.indexOf(item) === index,
  );
}
```

### BUG-CRD-02: FormData collection از طریق `zen-crud-form` محدود است
- **شدت:** کم
- **محل:** `src/crud.ts`
- **شرح:** جمع‌آوری داده‌های فرم از طریق attribute `zen-crud-form` انجام می‌شود اما اگر فرم دارای فیلدهای nested باشد (مانند `user[0].name`)، به درستی parse نمی‌شود.
- **نحوه رفع:** استفاده از `FormData` استاندارد یا serialization عمیق:

```typescript
function collectFormData(formEl: HTMLFormElement): Record<string, any> {
  const data: Record<string, any> = {};
  const formData = new FormData(formEl);
  for (const [key, value] of formData.entries()) {
    // پشتیبانی از keys like "user.name" یا "items[]"
    setNestedValue(data, key, value);
  }
  return data;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}
```

### BUG-CRD-03: `crudRefresh` بعد از `crudCreate` لیست را به‌روز نمی‌کند
- **شدت:** متوسط
- **محل:** `src/crud.ts`
- **شرح:** v1.2.7 رفع کرده که بعد از `crudDelete` لیست refresh شود، اما بعد از `crudCreate` لیست هنوز به‌روز نمی‌شود.
- **نحوه رفع:** افزودن auto-refresh بعد از create:

```typescript
registerAction('crudCreate', async (context: any) => {
  const { resource, data } = context;
  await resource.create(data);
  // Auto-refresh لیست بعد از ایجاد
  if (context.autoRefresh !== false) {
    await crudRefresh(context);
  }
});
```

---

## ۴. پیشنهادات ارتقا

### IMP-CRD-01: افزودن batched operations
- **دلیل:** حذف/به‌روزرسانی هم‌زمان چند آیتم.
- **پیاده‌سازی:**

```typescript
registerAction('crudBulkDelete', async (context: any) => {
  const { resource, ids } = context;
  await Promise.all(ids.map((id: string) => resource.delete(id)));
  await crudRefresh(context);
});
```

### IMP-CRD-02: افزودن pagination-aware list management
- **دلیل:** اگر لیست صفحه‌بندی شده باشد، پس از حذف آیتم آخر صفحه باید به صفحه قبل برگردد.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **actions** | CRUD actions از طریق `registerAction` ثبت می‌شوند. | ✅ درست |
| **resource** | `Resource` کلاس برای عملیات داده. | ✅ درست |
| **runtime/directives** | `zen-crud-*` attributes در walker پردازش می‌شوند. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `crud` یک لایه سطح بالا و کاربردی روی `resource` است که با optimistic operations سرعت کار با داده را افزایش می‌دهد. مشکل اصلی آن ناقص بودن auto-refresh (بعد از create) و خطر rollback در optimistic delete است.

**امتیاز کلی: ۶.۵/۱۰** (کاربردی اما نیاز به تکمیل auto-refresh و rollback safety)
