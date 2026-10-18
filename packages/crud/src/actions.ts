import { Zen } from '@zenith/runtime';
import { getAction, type ActionFn, type ActionContext } from '@zenith/actions';
import { getPermissionManager } from '@zenith/permission';
import { logger } from '@zenith/logger';
import type { CrudScope } from './scope';

/** Private engine helper. @internal */
export function registerActions(this: CrudScope): void {
  const res = this.config.resource;

  // ── Sort Actions (یکی برای هر ستون sortable) ──
  for (const col of this.config.columns) {
    if (!col.sortable) continue;
    const actionName = `__crud_${res}_sort_${col.field}`;
    Zen.action(
      actionName,
      this.guardAction(() => {
        const currentSort = this.sortBy.get();
        const currentDir = this.sortDir.get();
        if (currentSort === col.field) {
          this.sortDir.set(currentDir === 'asc' ? 'desc' : 'asc');
        } else {
          this.sortBy.set(col.field);
          this.sortDir.set('asc');
        }
      }),
    );
    this.registeredActions.push(actionName);
  }

  // ── Pagination Actions ──
  const prevAction = `__crud_${res}_prevPage`;
  Zen.action(
    prevAction,
    this.guardAction(() => {
      const p = this.currentPage.get();
      if (p > 1) this.currentPage.set(p - 1);
    }),
  );
  this.registeredActions.push(prevAction);

  const nextAction = `__crud_${res}_nextPage`;
  Zen.action(
    nextAction,
    this.guardAction(() => {
      const p = this.currentPage.get();
      const tp = this.totalPages.get();
      if (p < tp) this.currentPage.set(p + 1);
    }),
  );
  this.registeredActions.push(nextAction);

  const gotoAction = `__crud_${res}_gotoPage`;
  Zen.action(
    gotoAction,
    this.guardAction(({ element }: ActionContext) => {
      const pageAttr = element.getAttribute('data-page');
      if (!pageAttr) return;
      const page = parseInt(pageAttr, 10);
      const tp = this.totalPages.get();
      if (!isNaN(page) && page >= 1 && page <= tp) {
        this.currentPage.set(page);
      }
    }),
  );
  this.registeredActions.push(gotoAction);

  // ── Row Actions ──
  for (const action of this.config.rowActions ?? []) {
    const actionName = `__crud_${res}_row_${action.name}`;
    Zen.action(
      actionName,
      // FIX (v1.2.7): pass action.permission to guardAction so it can
      // re-check the permission at fire-time (not just at render-time).
      this.guardAction((ctx: ActionContext) => {
        // اگر confirm=true، ابتدا تایید بگیر.
        if (action.confirm) {
          const msg = `آیا از «${action.label}» مطمئن هستید؟`;
          // SSR safety: confirm فقط در browser وجود دارد.
          if (typeof confirm === 'function' && !confirm(msg)) return;
        }
        // Action کاربر را از registry بگیر و اجرا کن.
        const userAction = getAction(action.action);
        if (userAction) {
          try {
            void userAction(ctx);
          } catch (e) {
            logger.error(
              `[CrudEngine] Row action "${action.action}" failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } else {
          logger.warn(
            `[CrudEngine] Action "${action.action}" not registered. ` +
              `Register it via Zen.action('${action.action}', fn).`,
          );
        }
      }, action.permission),
    );
    this.registeredActions.push(actionName);
  }

  // ── Table Actions ──
  for (const action of this.config.tableActions ?? []) {
    const actionName = `__crud_${res}_table_${action.name}`;
    Zen.action(
      actionName,
      // FIX (v1.2.7): pass action.permission to guardAction so it can
      // re-check the permission at fire-time (not just at render-time).
      this.guardAction((ctx: ActionContext) => {
        const userAction = getAction(action.action);
        if (userAction) {
          try {
            void userAction(ctx);
          } catch (e) {
            logger.error(
              `[CrudEngine] Table action "${action.action}" failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } else {
          logger.warn(
            `[CrudEngine] Action "${action.action}" not registered. ` +
              `Register it via Zen.action('${action.action}', fn).`,
          );
        }
      }, action.permission),
    );
    this.registeredActions.push(actionName);
  }
}

/** Private engine helper. @internal */
export function guardAction(this: CrudScope, fn: ActionFn, permission?: string): ActionFn {
  return ((ctx: ActionContext) => {
    const event = ctx?.event;
    if (event && typeof event === 'object') {
      if ((event as Event & { __crudHandled?: boolean }).__crudHandled) return;
      (event as Event & { __crudHandled?: boolean }).__crudHandled = true;
    }
    // FIX (v1.2.7): re-check permission before executing the user action.
    // zen-permission wiring hides the button when the user lacks the
    // permission, but a crafted event (or a stale DOM after permissions
    // changed) could still trigger the registered action handler. This
    // re-check is the authoritative gate; the visible-button check is
    // only a UX nicety.
    if (permission) {
      const manager = getPermissionManager();
      if (manager && !manager.checkPermission(permission)) {
        logger.warn(`[CrudEngine] Permission denied for action requiring "${permission}".`);
        return;
      }
    }
    try {
      return fn(ctx);
    } catch (e) {
      logger.error(
        `[CrudEngine] Action handler failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });
}
