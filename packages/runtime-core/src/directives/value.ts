import { effect, isWritable } from '@zenith/state';
import { isReadable } from '@zenith/shared';
import { sanitizeHTMLInDocument } from '@zenith/security';
import { defineDirective } from '../scope';
import { handleAppError } from '../errors';
import type { DirectiveDefinition } from '../types';
import { createEvalContext, evalExpr, resolveRawTarget, applyAttributeBinding, type MemoMarkedElement } from './shared';

export function buildValueDirectives(): DirectiveDefinition[] {
  const zenMemo = defineDirective({
    name: 'zen-memo',
    priority: 800,
    bind(el, ctx) {
      let prevDeps: unknown[] | null = null;
      const stop = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = evalExpr(ctx.expr, evalCtx, ctx.app);
        const nextDeps = Array.isArray(val) ? val : [val];
        const unchanged =
          prevDeps !== null &&
          prevDeps.length === nextDeps.length &&
          prevDeps.every((d, i) => Object.is(d, nextDeps[i]));
        (el as MemoMarkedElement).__zenMemoUnchanged = unchanged;
        prevDeps = nextDeps;
      });
      return () => {
        stop();
        delete (el as MemoMarkedElement).__zenMemoUnchanged;
      };
    },
  });

  const zenRef = defineDirective({
    name: 'zen-ref',
    priority: 700,
    bind(el, ctx) {
      const targetName = ctx.expr.trim().replace(/^\$/, '');
      const target = resolveRawTarget(targetName, ctx.state, ctx.context);
      if (isWritable(target)) {
        Reflect.apply(target.set, target, [el]);
        return () => { Reflect.apply(target.set, target, [null]); };
      }
      const current = ctx.state.refs;
      const refs = current && typeof current === 'object' ? current as Record<string, unknown> : Object.create(null) as Record<string, unknown>;
      if (refs !== current) ctx.state.refs = refs;
      Object.defineProperty(refs, targetName, { value: el, configurable: true, enumerable: true, writable: true });
      return () => { if (ctx.state.refs === refs && refs[targetName] === el) delete refs[targetName]; };
    },
  });

  const zenText = defineDirective({
    name: 'zen-text',
    priority: 500,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const value = evalExpr(ctx.expr, evalCtx, ctx.app);
        if ((el as MemoMarkedElement).__zenMemoUnchanged === true && initialized) return;
        el.textContent = value === undefined || value === null ? '' : String(value);
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenHtml = defineDirective({
    name: 'zen-html',
    priority: 500,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const value = evalExpr(ctx.expr, evalCtx, ctx.app);
        if ((el as MemoMarkedElement).__zenMemoUnchanged === true && initialized) return;
        const raw = value === undefined || value === null ? '' : String(value);
        el.innerHTML = sanitizeHTMLInDocument(raw, el.ownerDocument);
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenShow = defineDirective({
    name: 'zen-show',
    priority: 500,
    bind(el, ctx) {
      const originalDisplay = el.style.display;
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const visible = Boolean(evalExpr(ctx.expr, evalCtx, ctx.app));
        el.style.display = visible ? originalDisplay : 'none';
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenCloak = defineDirective({
    name: 'zen-cloak',
    priority: 500,
    bind(el) {
      el.removeAttribute('zen-cloak');
    },
  });

  const zenBind = defineDirective({
    name: 'zen-bind',
    priority: 500,
    prefixMatch: true,
    bind(el, ctx) {
      let initialized = false;
      return effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = evalExpr(ctx.expr, evalCtx, ctx.app);
        if (ctx.arg) {
          applyAttributeBinding(el, ctx.arg, val);
        } else if (val && typeof val === 'object') {
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            applyAttributeBinding(el, k, v);
          }
        }
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });
    },
  });

  const zenModel = defineDirective({
    name: 'zen-model',
    priority: 500,
    bind(el, ctx) {
      const target = resolveRawTarget(ctx.expr, ctx.state, ctx.context);
      const isLazy = el.hasAttribute('zen-model-lazy') || ctx.modifiers.includes('lazy');
      const isTrim = el.hasAttribute('zen-model-trim') || ctx.modifiers.includes('trim');
      const isNumber = el.hasAttribute('zen-model-number') || ctx.modifiers.includes('number');

      const inputEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const isCheckbox =
        inputEl.tagName === 'INPUT' && (inputEl as HTMLInputElement).type === 'checkbox';

      let initialized = false;
      const stopEffect = effect(() => {
        const evalCtx = createEvalContext(ctx.state, ctx.context);
        const val = isReadable(target) ? target.get() : evalExpr(ctx.expr, evalCtx, ctx.app);
        if (isCheckbox) {
          (inputEl as HTMLInputElement).checked = Boolean(val);
        } else {
          inputEl.value = val === undefined || val === null ? '' : String(val);
        }
        if (initialized) ctx.notifyUpdate();
        initialized = true;
      });

      const eventName = isLazy || isCheckbox || inputEl.tagName === 'SELECT' ? 'change' : 'input';
      const handler = () => {
        if (!isWritable(target)) return;
        if (isCheckbox) {
          Reflect.apply(target.set, target, [(inputEl as HTMLInputElement).checked]);
          return;
        }
        let nextVal: string | number = inputEl.value;
        if (isTrim) nextVal = nextVal.trim();
        if (isNumber) {
          const parsed = Number(nextVal);
          if (!Number.isNaN(parsed)) nextVal = parsed;
        }
        Reflect.apply(target.set, target, [nextVal]);
      };

      inputEl.addEventListener(eventName, handler);
      return () => {
        stopEffect();
        inputEl.removeEventListener(eventName, handler);
      };
    },
  });

  const zenAction = defineDirective({
    name: 'zen-action',
    priority: 100,
    prefixMatch: true,
    bind(el, ctx) {
      const eventName = ctx.arg || 'click';
      const actionName = ctx.expr.trim();
      const handler = (event: Event) => {
        if (ctx.modifiers.includes('self') && event.target !== el) return;
        if (ctx.modifiers.includes('prevent')) event.preventDefault();
        if (ctx.modifiers.includes('stop')) event.stopPropagation();

        const rawTarget = resolveRawTarget(actionName, ctx.state, ctx.context);
        if (typeof rawTarget === 'function') {
          try {
            ctx.app.run(() => rawTarget({ state: ctx.state, event, el, app: ctx.app }));
          } catch (err) {
            handleAppError(ctx.app, err);
          }
          return;
        }
        const evalCtx = createEvalContext(ctx.state, { ...ctx.context, $event: event });
        ctx.app.run(() => evalExpr(ctx.expr, evalCtx, ctx.app));
      };

      const opts: AddEventListenerOptions = {
        once: ctx.modifiers.includes('once'),
      };
      el.addEventListener(eventName, handler, opts);
      return () => el.removeEventListener(eventName, handler, opts);
    },
  });

  return [zenMemo, zenRef, zenText, zenHtml, zenShow, zenCloak, zenBind, zenModel, zenAction];
}
