import { expectTypeOf, it } from 'vitest';
import { signal } from '@zenith/state';
import type { HeadInput, HeadOptions, HeadTitleTemplate, HeadDedupe } from '../src';
it('accepts readable templates and field values, selective dedupe and callback title inference', () => {
  const template: HeadTitleTemplate = title => { expectTypeOf(title).toEqualTypeOf<string>(); return `${title} | Site`; };
  const dedupe: HeadDedupe = ['name', 'property', 'key']; const options: HeadOptions = { titleTemplate: template, dedupe }; const input: HeadInput = { title: signal('Title'), titleTemplate: signal<HeadTitleTemplate>(template), meta: signal([{ name: 'description', content: 'Description' }]) }; expectTypeOf(options).toMatchTypeOf<HeadOptions>(); expectTypeOf(input).toMatchTypeOf<HeadInput>();
  // @ts-expect-error arbitrary dedupe strategies are not supported
  const invalid: HeadOptions = { dedupe: ['content'] }; void invalid;
});
