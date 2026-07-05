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
import { getResource } from '@zenith/resource';
import { Zen } from '@zenith/runtime';
/**
 * Action: crudList — Refresh یک Resource.
 *
 * HTML:
 *   <button zen-action="crudList" zen-bind:data-resource="users">Refresh</button>
 */
Zen.action('crudList', ({ element }) => {
    const resourceName = element.getAttribute('data-resource');
    if (!resourceName) {
        console.error('[crudList] data-resource required');
        return;
    }
    const resource = getResource(resourceName);
    if (!resource) {
        console.error(`[crudList] Resource "${resourceName}" not found`);
        return;
    }
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
    if (!resourceName) {
        console.error('[crudCreate] data-resource required');
        return;
    }
    const resource = getResource(resourceName);
    if (!resource) {
        console.error(`[crudCreate] Resource "${resourceName}" not found`);
        return;
    }
    // جمع‌آوری داده‌های فرم.
    const form = element.tagName === 'FORM' ? element : element.closest('form');
    if (!form) {
        console.error('[crudCreate] No form found');
        return;
    }
    const formData = new FormData(form);
    const body = {};
    for (const [key, value] of formData.entries()) {
        body[key] = value;
    }
    const result = await resource.create(body);
    if (result.success) {
        // پاک کردن فرم.
        form.reset();
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
    if (!resourceName || !id) {
        console.error('[crudUpdate] data-resource and data-id required');
        return;
    }
    const resource = getResource(resourceName);
    if (!resource) {
        console.error(`[crudUpdate] Resource "${resourceName}" not found`);
        return;
    }
    // body می‌تواند از data-body attribute خوانده شود.
    let body = bodyAttr;
    if (bodyAttr) {
        try {
            body = JSON.parse(bodyAttr);
        }
        catch { /* keep as string */ }
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
    if (!resourceName || !id) {
        console.error('[crudDelete] data-resource and data-id required');
        return;
    }
    const resource = getResource(resourceName);
    if (!resource) {
        console.error(`[crudDelete] Resource "${resourceName}" not found`);
        return;
    }
    // Optimistic delete با snapshot برای rollback.
    let snapshot = null;
    if (resource.data && Array.isArray(resource.data)) {
        snapshot = [...resource.data];
        resource.setData(old => old.filter(item => String(item.id) !== String(id)));
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
    if (!resourceName)
        return;
    const resource = getResource(resourceName);
    if (resource)
        resource.list(true);
});
/**
 * ثبت همه‌ی CRUD actions.
 * این تابع باید در زمان init صدا زده شود.
 */
export function registerCrudActions() {
    // Actions قبلاً ثبت شده‌اند (در module load).
    // این تابع برای API completeness وجود دارد.
}
export { getResource };
//# sourceMappingURL=crud.js.map