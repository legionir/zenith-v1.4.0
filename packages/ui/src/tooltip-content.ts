import { createRoot, effect } from '@zenith/state';
import { createReservedError } from '@zenith/errors';
import { ownership } from './internal';

/**
 * Own only presentation/text, not authored node positions. Keeping the structure
 * connected lets a reactive arrow selector keep finding inactive authored arrows.
 * The surface must dispose before this projection restores display properties.
 */
export function bindTooltipContent(el: HTMLElement, read: () => unknown, readArrow: () => HTMLElement | undefined, readTrigger: () => HTMLElement | string | undefined, closed: () => boolean) {
  const owner = ownership(el), doc = el.ownerDocument, text = doc.createTextNode('');
  const elements = Array.from(el.querySelectorAll<HTMLElement>('*')).map(node => ({
    node, hidden: node.getAttribute('hidden'),
    display: node.style.getPropertyValue('display'), priority: node.style.getPropertyPriority('display'), hadStyle: node.hasAttribute('style'), style: node.getAttribute('style'),
  }));
  const texts: Array<{ node: Text; data: string }> = [];
  const walker = doc.createTreeWalker(el, 4); let next: Node | null;
  while ((next = walker.nextNode())) texts.push({ node: next as Text, data: next.nodeValue ?? '' });
  let revision = 0, trigger: HTMLElement | undefined, releaseTrigger = () => {};
  owner.add(() => releaseTrigger());
  const display = (entry: typeof elements[number], hide: boolean) => {
    if (hide) entry.node.style.setProperty('display', 'none', 'important');
    else if (entry.display) entry.node.style.setProperty('display', entry.display, entry.priority);
    else entry.node.style.removeProperty('display');
    if (!entry.hadStyle && !entry.node.style.length) entry.node.removeAttribute('style');
  };
  owner.add(() => {
    revision++; const errors: unknown[] = [];
    try { text.remove(); } catch (error) { errors.push(error); }
    for (const entry of texts) { try { entry.node.data = entry.data; } catch (error) { errors.push(error); } }
    for (const entry of elements) { try { if (entry.style === null) entry.node.removeAttribute('style'); else entry.node.setAttribute('style', entry.style); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'Tooltip content restoration failed.');
  });
  try {
    el.insertBefore(text, el.firstChild);
    if (!owner.disposed) createRoot(dispose => {
      // Acquire the owner before effect() runs synchronously: a failing initial
      // expression must not leave an inaccessible reactive owner behind.
      owner.add(dispose);
      owner.add(effect(() => {
        const value = read(), arrow = readArrow(), configuredTrigger = readTrigger(), content = value == null ? '' : String(value);
        let target: HTMLElement | null | undefined;
        try { target = typeof configuredTrigger === 'string' ? doc.querySelector<HTMLElement>(configuredTrigger) : configuredTrigger; } catch { throw createReservedError('ZEN-1601'); }
        if (!target || target === el || el.contains(target) || target.ownerDocument !== doc) throw createReservedError('ZEN-1601');
        if (arrow && (arrow === el || !el.contains(arrow) || arrow.ownerDocument !== doc)) throw createReservedError('ZEN-1601');
        const version = ++revision, current = () => !owner.disposed && !closed() && revision === version;
        if (!current()) return;
        if (target !== trigger) { releaseTrigger(); trigger = target; releaseTrigger = owner.watch(target); }
        for (const entry of elements) {
          if (!current()) return;
          const retained = !!arrow && (entry.node === arrow || entry.node.contains(arrow) || arrow.contains(entry.node));
          owner.attr(entry.node, 'hidden', retained ? entry.hidden : '');
          if (!current()) return;
          owner.attr(entry.node, 'aria-hidden', 'true');
          if (!current()) return;
          owner.attr(entry.node, 'inert', '');
          if (!current()) return;
          display(entry, !retained);
        }
        for (const entry of texts) { if (!current()) return; entry.node.data = arrow?.contains(entry.node) ? entry.data : ''; }
        if (current()) text.data = content;
      }));
    });
    return { dispose: owner.dispose };
  } catch (error) { try { owner.dispose(); } catch {} throw error; }
}
