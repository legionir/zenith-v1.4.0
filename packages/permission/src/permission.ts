import { createScopedRegistry } from '@zenith/shared';
// packages/permission/src/permission.ts
//
// @zenith/permission — Authorization Runtime (Phase 4).
//
// این پکیج مدیریت authorization را فراهم می‌کند:
//   - Role-based access control (RBAC)
//   - Permission-based access control
//   - دایرکتیو zen-permission برای conditional rendering
//   - دایرکتیو zen-role برای conditional rendering
//   - Guard functions برای route protection
//   - Integration با @zenith/auth
//
// ── سینتکس ─ـ
//
//   <!-- Permission-based -->
//   <button zen-permission="users:delete" zen-action="crudDelete">Delete</button>
//   <div zen-permission="any:users:edit,users:create">Edit or Create</div>
//   <div zen-permission="all:users:edit,users:create">Edit AND Create</div>
//
//   <!-- Role-based -->
//   <div zen-role="admin">Admin Panel</div>
//   <div zen-role="any:admin,editor">Editor Section</div>
//   <div zen-role="all:admin,verified">Verified Admin</div>
//
//   <!-- اگر دسترسی نداشت، fallback نمایش داده می‌شود -->
//   <div zen-permission="admin:access">
//     <p>Admin content</p>
//     <template zen-fallback>
//       <p>Access denied</p>
//     </template>
//   </div>

export * from './permission-foundation';
export * from './permission-manager';
export * from './permission-registry';
export * from './permission-guards';
