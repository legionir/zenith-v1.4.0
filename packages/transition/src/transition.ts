// packages/transition/src/transition.ts
//
// Transition/Animation — قابلیت غایب فاز ۹ (فاز ۱۱).
//
// این ماژول enter/leave animations را برای zen-if و zen-for فراهم می‌کند.
//
// ── سینتکس ──
// <div zen-if="$show" zen-transition="fade">
//   محتوا
// </div>
//
// ── نحوه کار ─ـ
// وقتی zen-if=true (enter):
// 1) عنصر به DOM اضافه می‌شود.
// 2) کلاس `zen-enter-from` اضافه می‌شود.
// 3) در فریم بعدی، `zen-enter-from` حذف و `zen-enter-to` اضافه می‌شود.
// 4) بعد از پایان transition، `zen-enter-to` حذف می‌شود.
//
// وقتی zen-if=false (leave):
// 1) کلاس `zen-leave-from` اضافه می‌شود.
// 2) در فریم بعدی، `zen-leave-from` حذف و `zen-leave-to` اضافه می‌شود.
// 3) بعد از پایان transition، عنصر از DOM حذف می‌شود.
//
// ── CSS ─ـ
// کاربر باید CSS های زیر را تعریف کند:
// .fade.zen-enter-from { opacity: 0; }
// .fade.zen-enter-to { opacity: 1; transition: opacity 0.3s; }
// .fade.zen-leave-from { opacity: 1; }
// .fade.zen-leave-to { opacity: 0; transition: opacity 0.3s; }


export * from './transition-types';
export * from './transition-legacy';
export * from './transition-group';
export * from './transition-core';
export * from './transition-animate';
