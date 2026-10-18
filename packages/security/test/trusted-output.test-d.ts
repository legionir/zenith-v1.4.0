import { expectTypeOf } from 'vitest';
import { createTrustedTypesPolicy, setSafeInnerHTML, type TrustedTypePolicy, type SafeInnerHTMLOptions } from '../src';
declare const policy: TrustedTypePolicy;
expectTypeOf(policy.createHTML('')).toEqualTypeOf<unknown>();
expectTypeOf(policy.createScriptURL('')).toEqualTypeOf<unknown>();
// @ts-expect-error A browser policy may return an opaque object rather than a string.
const text: string = policy.createHTML('');
void text;
expectTypeOf(createTrustedTypesPolicy()).toEqualTypeOf<TrustedTypePolicy | null>();
declare const element: Element;
const options: SafeInnerHTMLOptions = { html: '<p>safe</p>', trusted: false };
setSafeInnerHTML(element, options);
setSafeInnerHTML(element, '<p>legacy</p>', false);
