/**
 * خروجی تجزیه‌ی یک Attribute Name.
 */
export interface ParsedEventBinding {
    eventName: string;
    modifiers: string[];
}
export declare function parseBinding(rawBinding: string): ParsedEventBinding;
export declare function checkKeyboardModifiers(event: KeyboardEvent, modifiers: string[]): boolean;
/**
 * FEATURE (v1.3.0): Event Modifier Handler.
 */
export type EventModifierHandler = (event: Event, modifiers: string[], element: HTMLElement) => boolean | void;
/**
 * FEATURE (v1.3.0): مجموعه‌ی نام modifier های built-in.
 */
export declare const BUILTIN_MODIFIERS: Set<string>;
export declare function registerEventModifier(name: string, handler: EventModifierHandler): void;
export declare function unregisterEventModifier(name: string): boolean;
export declare function clearEventModifiers(): void;
export declare function hasEventModifier(name: string): boolean;
export declare function getEventModifier(name: string): EventModifierHandler | undefined;
/**
 * اعمال modifier های رفتاری روی رویداد.
 *
 * FEATURE (v1.3.0): custom modifiers via registerEventModifier.
 *
 * @returns `true` اگر رویداد مجاز به ادامه است، `false` اگر باید متوقف شود.
 */
export declare function applyBehaviorModifiers(event: Event, modifiers: string[], element?: HTMLElement): boolean;
export declare const DELEGATED_EVENTS: readonly ["click", "input", "change", "submit", "keydown", "keyup", "focusin", "focusout"];
export type DelegatedEventName = (typeof DELEGATED_EVENTS)[number];
//# sourceMappingURL=modifiers.d.ts.map
