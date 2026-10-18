import { Zen } from '@zenith/runtime';
import { processPermission } from '@zenith/permission';
import { logger } from '@zenith/logger';
import type { CrudScope } from './scope';

/** Private engine helper. @internal */
export function wirePermissions(this: CrudScope): void {
  // پاکسازی permission disposes قبلی (اگر re-render شده).
  for (const d of this.permissionDisposes) {
    try {
      d();
    } catch {
      // ignore
    }
  }
  this.permissionDisposes = [];

  const permissionEls = this.host.querySelectorAll('[zen-permission]');
  for (const el of Array.from(permissionEls)) {
    const expr = el.getAttribute('zen-permission') || '';
    // attribute را حذف کن تا در re-processing دوباره پردازش نشود.
    el.removeAttribute('zen-permission');
    try {
      const d = processPermission(el as HTMLElement, expr);
      this.permissionDisposes.push(d);
    } catch (e) {
      logger.error(
        `[CrudEngine] Failed to wire zen-permission: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/** Private engine helper. @internal */
export function cleanupRender(this: CrudScope): void {
  // Dispose permission effects.
  for (const d of this.permissionDisposes) {
    try {
      d();
    } catch {
      // ignore
    }
  }
  this.permissionDisposes = [];

  // Dispose walker-created effects on the host.
  if (typeof document !== 'undefined' && this.host) {
    const disposes = this.host.__zenithDisposes as (() => void)[] | undefined;
    if (disposes) {
      for (const d of disposes) {
        try {
          d();
        } catch {
          // ignore
        }
      }
      disposes.length = 0;
      delete this.host.__zenithDisposes;
    }

    // Remove event delegation listeners created by Zen.start on this host.
    const teardown = this.host.__zenithDelegationTeardown as (() => void) | undefined;
    if (typeof teardown === 'function') {
      try {
        teardown();
      } catch {
        // ignore
      }
      delete this.host.__zenithDelegationTeardown;
    }

    // Clear host content.
    this.host.innerHTML = '';
  }

  // Unregister dynamic actions.
  for (const name of this.registeredActions) {
    try {
      Zen.action.unregister(name);
    } catch {
      // ignore
    }
  }
  this.registeredActions = [];

  this.rendered = false;
}
