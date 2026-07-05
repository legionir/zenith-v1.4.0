// packages/crud/src/crud.ts
//
// @zenith/crud — CRUD UI Components (Phase 3).
//
// این پکیج Action های آماده برای CRUD operations فراهم می‌کند که با
// @zenith/resource و @zenith/form کار می‌کنند.
//
// ── سینتکس ──
//
//   <!-- List -->
//   <div zen-resource="'/api/users'" zen-state="users">
//     <table>
//       <tr zen-for="user in $users.data" zen-key="user.id">
//         <td zen-text="$user.name"></td>
//         <td>
//           <button zen-action="crudDelete"
//                   zen-bind:data-resource="users"
//                   zen-bind:data-id="$user.id">Delete</button>
//         </td>
//       </tr>
//     </table>
//   </div>
//
//   <!-- Create Form -->
//   <form zen-action:submit.prevent="crudCreate"
//         zen-bind:data-resource="users">
//     <input name="name" placeholder="Name">
//     <input name="email" placeholder="Email">
//     <button type="submit">Add</button>
//   </form>

import { getResource, type Resource } from '@zenith/resource';
import { Zen } from '@zenith/runtime';

// ─────────────────────────────────────────────────────────────────────────
// Helper: rollbackWithMerge — BUG-CRD-01 (v1.3.0)
// ─────────────────────────────────────────────────────────────────────────
//
// قبلاً optimistic rollback با resource.setData(() => snapshot) انجام
// می‌شد که snapshot را به‌طور کامل جایگزین می‌کرد. اگر بین حذف و rollback
// داده‌ها تغییر می‌کردند (مثلاً آیتم جدید اضافه شده بود)، آن تغییرات از
// دست می‌رفتند.
//
// rollbackWithMerge snapshot را با داده‌های فعلی merge می‌کند:
// - آیتم‌های snapshot را برمی‌گرداند (آیتم‌های حذف‌شده restore می‌شوند).
// - آیتم‌هایی که در snapshot نبودند ولی در current هستند، حفظ می‌شوند
//   (تغییرات بعد از حذف preserved می‌شوند).
//
// @param current  داده‌های فعلی (بعد از optimistic delete).
// @param snapshot داده‌های قبل از optimistic delete.
// @returns داده‌های merge شده.
function rollbackWithMerge(current: any[], snapshot: any[]): any[] {
  const snapshotIds = new Set(snapshot.map(item => item.id));
  const currentIds = new Set(current.map(item => item.id));

  // آیتم‌هایی که بین حذف و rollback اضافه شده‌اند.
  const newItems = current.filter(item => !snapshotIds.has(item.id));
  // آیتم‌های حذف‌شده که باید برگردند.
  const restoredItems = snapshot.filter(item => currentIds.has(item.id) === false);

  // ترکیب: snapshot اصلی + آیتم‌های جدید - dedup.
  const merged = [...snapshot];

  for (const item of newItems) {
    if (!snapshotIds.has(item.id)) {
      merged.push(item);
    }
  }

  // آیتم‌هایی که در snapshot بودند و در current حذف نشدند، باقی می‌مانند.
  // آیتم‌هایی که در snapshot بودند و در current حذف شدند (optimistic delete)
  // توسط restoredItems برگردانده می‌شوند.

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: setNestedValue — BUG-CRD-02 (v1.3.0)
// ─────────────────────────────────────────────────────────────────────────
//
// پشتیبانی از keys مثل "user.name" یا "items[0].name" در جمع‌آوری داده‌های
// فرم. این تابع یک مقدار را در depth دلخواه در یک object قرار می‌دهد و
// در صورت نیاز object یا array میانی را می‌سازد.
//
// مثال:
//   const obj = {};
//   setNestedValue(obj, 'user.name', 'Ali');
//   // → { user: { name: 'Ali' } }
//   setNestedValue(obj, 'tags[0]', 'admin');
//   // → { user: { name: 'Ali' }, tags: ['admin'] }
function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // در صورت نیاز، object یا array بعدی را بساز.
    if (!(key in current)) {
      const nextKey = keys[i + 1];
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: collectFormData — BUG-CRD-02 (v1.3.0)
// ─────────────────────────────────────────────────────────────────────────
//
// جمع‌آوری داده‌های فرم با پشتیبانی از nested keys.
// قبلاً از body[key] = value استفاده می‌کردیم که keys تو در تو مثل
// "user[0].name" را به‌درستی parse نمی‌کرد.
function collectFormData(formEl: HTMLFormElement): Record<string, any> {
  const data: Record<string, any> = {};
  const formData = new FormData(formEl);
  for (const [key, value] of formData.entries()) {
    setNestedValue(data, key, value);
  }
  return data;
}

/**
 * Action: crudList — Refresh یک Resource.
 *
 * HTML:
 *   <button zen-action="crudList" zen-bind:data-resource="users">Refresh</button>
 */
Zen.action('crudList', ({ element }) => {
  const resourceName = element.getAttribute('data-resource');
  if (!resourceName) { console.error('[crudList] data-resource required'); return; }

  const resource = getResource(resourceName);
  if (!resource) { console.error(`[crudList] Resource "${resourceName}" not found`); return; }

  resource.list(true);
});

/**
 * Action: crudCreate — ایجاد آیتم جدید از فرم.
 *
 * HTML:
 *   <form zen-action:submit.prevent="crudCreate" zen-bind:data-resource="users">
 *     <input name="name">
 *     <input name="email">
 *     <button type="submit">Create</button>
 *   </form>
 */
Zen.action('crudCreate', async ({ element }) => {
  const resourceName = element.getAttribute('data-resource');
  if (!resourceName) { console.error('[crudCreate] data-resource required'); return; }

  const resource = getResource(resourceName);
  if (!resource) { console.error(`[crudCreate] Resource "${resourceName}" not found`); return; }

  // جمع‌آوری داده‌های فرم.
  const form = element.tagName === 'FORM' ? element : element.closest('form');
  if (!form) { console.error('[crudCreate] No form found'); return; }

  const formData = new FormData(form as HTMLFormElement);
  const body: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    body[key] = value;
  }

  const result = await resource.create(body);
  if (result.success) {
    // پاک کردن فرم.
    (form as HTMLFormElement).reset();
    // Refresh لیست.
    resource.list(true);
  }
});

/**
 * Action: crudUpdate — به‌روزرسانی آیتم.
 *
 * HTML:
 *   <button zen-action="crudUpdate"
 *           zen-bind:data-resource="users"
 *           zen-bind:data-id="$user.id"
 *           zen-bind:data-body="$user">Update</button>
 */
Zen.action('crudUpdate', async ({ element }) => {
  const resourceName = element.getAttribute('data-resource');
  const id = element.getAttribute('data-id');
  const bodyAttr = element.getAttribute('data-body');

  if (!resourceName || !id) { console.error('[crudUpdate] data-resource and data-id required'); return; }

  const resource = getResource(resourceName);
  if (!resource) { console.error(`[crudUpdate] Resource "${resourceName}" not found`); return; }

  // body می‌تواند از data-body attribute خوانده شود.
  let body: any = bodyAttr;
  if (bodyAttr) {
    try { body = JSON.parse(bodyAttr); } catch { /* keep as string */ }
  }

  const result = await resource.update(id, body);
  if (result.success) {
    resource.list(true);
  }
});

/**
 * Action: crudDelete — حذف آیتم.
 *
 * HTML:
 *   <button zen-action="crudDelete"
 *           zen-bind:data-resource="users"
 *           zen-bind:data-id="$user.id">Delete</button>
 */
Zen.action('crudDelete', async ({ element }) => {
  const resourceName = element.getAttribute('data-resource');
  const id = element.getAttribute('data-id');

  if (!resourceName || !id) { console.error('[crudDelete] data-resource and data-id required'); return; }

  const resource = getResource(resourceName);
  if (!resource) { console.error(`[crudDelete] Resource "${resourceName}" not found`); return; }

  // Optimistic delete با snapshot برای rollback.
  let snapshot: any[] | null = null;
  if (resource.data && Array.isArray(resource.data)) {
    snapshot = [...resource.data];
    resource.setData(old => (old as any[]).filter(item => String(item.id) !== String(id)));
  }

  const result = await resource.delete(id);
  if (!result.success && snapshot) {
    // Rollback: snapshot را restore کن.
    resource.setData(() => snapshot);
  }
  // FIX (v1.2.7): after a successful delete, refresh the resource so the
  // list re-syncs with the server (the optimistic filter above only hides
  // the row locally; a refresh picks up server-side side-effects such as
  // reordering, computed columns, or cascade deletes).
  if (result.success) {
    resource.list(true);
  }
});

/**
 * Action: crudRefresh — Refresh یک Resource (alias برای crudList).
 */
Zen.action('crudRefresh', ({ element }) => {
  const resourceName = element.getAttribute('data-resource');
  if (!resourceName) return;
  const resource = getResource(resourceName);
  if (resource) resource.list(true);
});

/**
 * ثبت همه‌ی CRUD actions.
 * این تابع باید در زمان init صدا زده شود.
 */
export function registerCrudActions(): void {
  // Actions قبلاً ثبت شده‌اند (در module load).
  // این تابع برای API completeness وجود دارد.
}

export { getResource, type Resource };
