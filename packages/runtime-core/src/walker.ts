import { createReservedError } from '@zenith/errors';
import { parseJsonAttr } from '@zenith/schema/attr';
import { parseConfigAttr, type Schema } from '@zenith/schema';
import { createDisposer } from '@zenith/shared';
import { signal } from '@zenith/state';
import type { App, BindContext, DirectiveDefinition } from './types';
import type { Registry } from './registry';
import { handleAppError } from './errors';
import { runInScope, flushMountCallbacks, triggerUpdateCallbacks, type ScopeFrame } from './scope';

export function createWalker(app: App, directives: Registry<DirectiveDefinition>) {
  let dirtyTags = true;
  const tags = new Map<string, DirectiveDefinition[]>();
  const stopTags = directives.subscribe(() => { dirtyTags = true; tags.clear(); });
  const tagDefinitions = (name: string): readonly DirectiveDefinition[] => {
    if (dirtyTags) {
      tags.clear();
      for (const def of new Set(directives.entries().map(([, value]) => value))) if (def.tag) {
        const values = tags.get(def.tag) ?? []; values.push(def); tags.set(def.tag, values);
      }
      dirtyTags = false;
    }
    return tags.get(name) ?? [];
  };
  function parseAttrDirective(
    attrName: string,
  ): { def: DirectiveDefinition; arg?: string; modifiers: string[] } | null {
    // 1. تطبیق دقیق
    const exact = directives.get(attrName);
    if (exact) {
      return { def: exact, modifiers: [] };
    }
    // 2. تطبیق با `:` و `.` (مثلاً `zen-bind:href` یا `zen-action:click.prevent.stop`)
    const colonIdx = attrName.indexOf(':');
    const dotIdx = attrName.indexOf('.');
    const splitIdx =
      colonIdx >= 0 && dotIdx >= 0 ? Math.min(colonIdx, dotIdx) : colonIdx >= 0 ? colonIdx : dotIdx;

    if (splitIdx > 0) {
      const baseName = attrName.slice(0, splitIdx);
      const def = directives.get(baseName);
      if (def) {
        const rest = attrName.slice(splitIdx);
        let arg: string | undefined;
        let modifiers: string[] = [];
        if (rest.startsWith(':')) {
          const parts = rest.slice(1).split('.');
          arg = parts[0];
          modifiers = parts.slice(1).filter(Boolean);
        } else if (rest.startsWith('.')) {
          modifiers = rest.slice(1).split('.').filter(Boolean);
        }
        return { def, arg, modifiers };
      }
    }
    return null;
  }

  function walkElement(
    el: HTMLElement,
    state: Record<string, unknown>,
    localCtx: Record<string, unknown>,
    parentFrame: ScopeFrame,
  ): void {
    if (parentFrame.disposes.isDisposed?.()) return;
    // 1. zen-static: عدم پیمایش زیرمجموعه
    if (el.hasAttribute('zen-static')) {
      el.removeAttribute('zen-static');
      return;
    }

    // 2. zen-state: ساخت سیگنال‌های محلی از JSON attribute
    let currentLocalCtx = localCtx;
    const namedStateOutput = el.getAttributeNames().some(name => parseAttrDirective(name)?.def.stateOutput);
    if (el.hasAttribute('zen-state') && !namedStateOutput) {
      // #120: مقدار attribute از مسیر مشترک خوانده می‌شود — پیش از حذف، چون
      // helper خودش attribute را از DOM می‌خواند (JSON خراب ⇒ ZEN-1003 به
      // handleAppError و بازگشت به {}؛ attribute غایب ⇒ {}).
      const parsed = parseJsonAttr<Record<string, unknown>>(el, 'zen-state', {
        fallback: {},
        onError: (err) => handleAppError(app, err),
      });
      el.removeAttribute('zen-state');
      const scopedSignals: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const local = signal(v); parentFrame.disposes.add(local); scopedSignals[k] = local;
      }
      currentLocalCtx = { ...localCtx, ...scopedSignals };
    }

    let childrenOwned = false;
    // 3. جمع‌آوری دایرکتیوهای روی این المان
    const matched: Array<{
      attrName: string;
      expr: string;
      def: DirectiveDefinition;
      arg?: string;
      modifiers: string[];
    }> = [];

    const attrNames = el.getAttributeNames ? el.getAttributeNames() : [];
    for (const attrName of attrNames) {
      const parsed = parseAttrDirective(attrName);
      if (parsed) {
        matched.push({
          attrName,
          expr: el.getAttribute(attrName) ?? '',
          def: parsed.def,
          arg: parsed.arg,
          modifiers: parsed.modifiers,
        });
      }
    }

    // Opt-in element directives share the same binding/SSR/cleanup path as
    // attributes; never call the same definition twice when both are present.
    for (const def of tagDefinitions(el.localName)) {
      if (!matched.some(item => item.def === def)) {
        matched.push({ attrName: def.name, expr: '', def, modifiers: [] });
      }
    }

    // 4. بررسی تداخل دایرکتیوهای ساختاری روی یک المان (ZEN-2302)
    const structuralMatches = matched.filter((m) => m.def.structural);
    if (structuralMatches.length > 1) {
      throw createReservedError('ZEN-2302', {
        details: {
          element: el.tagName,
          directives: structuralMatches.map((m) => m.def.name),
        },
      });
    }

    // 5. مرتب‌سازی بر اساس اولویت (بالاتر زودتر اجرا می‌شود؛ پیش‌فرض 500)
    matched.sort((a, b) => (b.def.priority ?? 500) - (a.def.priority ?? 500));

    const elFrame: ScopeFrame = {
      app,
      disposes: parentFrame.disposes,
      mountCallbacks: [],
      updateCallbacks: [],
      provides: new Map(),
      parent: parentFrame,
    };

    elFrame.disposes.add(() => { elFrame.mountCallbacks.length = 0; elFrame.updateCallbacks.length = 0; elFrame.provides.clear(); });
    for (const item of matched) {
      if (elFrame.disposes.isDisposed?.()) break;
      const bindCtx: BindContext = {
        expr: item.expr,
        attrName: item.attrName,
        arg: item.arg,
        modifiers: item.modifiers,
        context: currentLocalCtx,
        app,
        processChildren(targetNode, extraCtx) {
          if (elFrame.disposes.isDisposed?.()) return () => {};
          const mergedCtx = extraCtx ? { ...currentLocalCtx, ...extraCtx } : currentLocalCtx;
          const disposes = createDisposer(); let active = true;
          const release = () => { if (!active) return; active = false; elFrame.disposes.remove?.(release); disposes.dispose(); };
          elFrame.disposes.add(release);
          const childFrame: ScopeFrame = { app, disposes, mountCallbacks: [], updateCallbacks: [], provides: new Map(), parent: elFrame };
          try { walkSubtree(targetNode, state, mergedCtx, childFrame); flushMountCallbacks(childFrame); return release; }
          catch (error) { try { release(); } catch { /* retain the bind error */ } throw error; }
        },
        skipChildren() { childrenOwned = true; },
        disposes: elFrame.disposes,
        state,
        option(optName: string) {
          return el.getAttribute(`${item.def.name}-${optName}`);
        },
        config<T>(schema: Schema<T>): T {
          return parseConfigAttr(el, `${item.def.name}-options`, schema);
        },
        notifyUpdate() {
          triggerUpdateCallbacks(elFrame);
        },
      };

      const cleanup = runInScope(elFrame, () => item.def.bind(el, bindCtx));
      if (typeof cleanup === 'function') {
        if (elFrame.disposes.isDisposed?.()) cleanup(); else elFrame.disposes.add(cleanup);
      }
      flushMountCallbacks(elFrame);

      // دایرکتیو ساختاری خودش وظیفهٔ پیمایش cloneها را دارد
      if (item.def.structural) {
        return;
      }
    }

    // 6. پیمایش فرزندان
    if (childrenOwned || elFrame.disposes.isDisposed?.()) return;
    const children = Array.from(el.children) as HTMLElement[];
    for (const child of children) {
      walkElement(child, state, currentLocalCtx, elFrame);
    }
  }

  function walkSubtree(
    node: HTMLElement,
    state: Record<string, unknown>,
    localCtx: Record<string, unknown>,
    parentFrame: ScopeFrame,
  ): void {
    walkElement(node, state, localCtx, parentFrame);
  }

  return { walkElement, dispose() { stopTags(); tags.clear(); } };
}
