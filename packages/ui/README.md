# @zenith/ui

Headless L2 controllers with independent ESM subpaths. No CSS/theme or DOM work on
import. DOM, attributes, listeners, timers and asynchronous work have explicit owners.

```ts
import { createDialog } from '@zenith/ui/dialog';
const dialog = createDialog(document.querySelector('#confirm')!);
dialog.open();
// teardown, even while open:
dialog.dispose();
```

Components: dialog, popover, tooltip, tabs, menu, accordion, combobox, date-picker
and portal. `@zenith/ui/position` exports viewport-space `computePosition` and
`autoUpdate`. Floating controllers convert viewport coordinates to document-space
absolute positions and expose placement/anchor/available-height CSS variables.

`uiPlugin()` installs `zen-dialog`, `zen-popover`, `zen-tooltip`, `zen-tabs`,
`zen-menu`, `zen-accordion` and `zen-combobox`. All registrations/bindings are App-owned.
SSR skips floating/client-network controllers. Dialog/disclosure markup can be
serialized; no server focus or scroll lock is acquired.

Author accessible markup: name dialogs with `[zen-dialog-title]` or `aria-label`,
use actual buttons for triggers, `[zen-tablist]/[zen-tab]/[zen-tabpanel]`,
`[zen-accordion-item]/[zen-accordion-trigger]/[zen-accordion-panel]`, and
`input + [zen-combobox-list]` inside a combobox root. Floating surfaces require an
explicit trigger element/selector. Disabled options are skipped. Combobox requests
are abortable and generation-checked; original list children return on teardown.

Legacy runtime date-picker and portal imports forward to these exact implementations;
core positioning forwards to the position subpath. `createPortal` rejects invalid
targets; legacy `processPortal` retains the body fallback.

State views expose observation, not controller mutation. Nested modal background
inertness follows the top document-owned modal; scroll leases are reference counted.
Tests are written, but no final keyboard/axe/three-browser, size or publish acceptance
has been run. APG coverage and all spec-option parity must be verified before release.


Escape arbitration is document-owned and shared with focus traps/notifications.
Only the most recently active, accepting layer closes; a popover inside a dialog
does not also dismiss the dialog. Nonmodal dialogs participate without trapping
Tab. `dispose` is terminal; floating geometry and Escape leases are released.

`createTabs({ lazy: true, mountPanel })` parks unvisited content as original DOM
nodes, mounts each panel once and owns returned cleanups. The `zen-tabs-lazy`
plugin form binds newly visited content through the captured App context rather
than creating a second app or rebinding the initial panel. Nested tablists are
filtered out of parent roving collections. Unvisited nodes return on disposal.

A menu item can reference a submenu with `zen-menu-submenu="#child-menu"`.
Forward/back arrows follow inherited RTL direction; Escape closes one level and
returns to its trigger. Selection closes the parent chain unless closeOnSelect
is false. `zen-menu-radio="group"` isolates independent radio groups. Submenu
cycles are rejected, not recursively constructed. The legacy Jalali date-picker
uses a grid/row/header structure, one day tab stop, arrows/Home/End/PageUp/Down
(Shift changes year), and Enter/Space selection. It releases replaced listeners
on every render/disconnect and rebinds on reconnect. Browser/axe/size acceptance
is still pending; these descriptions are implementation contracts, not passes.

Server-side unvisited lazy content is serialized inside an inert
`<template data-zen-lazy-panel>` rather than silently omitted. The client unwraps
it into parked original nodes, then binds on the first visit. This preserves
inactive panel content across SSR without eagerly running its directives.

Portaled submenus remain logical descendants for outside-click detection and
selection/Tab dismissal. This is not yet certification of every modal+portal
combination: focus/inert behavior for arbitrary floating portals across modal
boundaries remains part of the outstanding APG/browser review.

Code-first continuation: modal focus traps now resolve logical floating containers
live, and background inertness follows their ancestor paths without enabling
unrelated siblings in the portal host. Open/close/removal refreshes the lease.
Date-picker registration uses the owner document's custom-element registry and
constructor, without changing globals. `min`, `max`, `disabled`, JSON
`disabled-dates` (up to 4096 entries), clearing `value`, and an explicit stylesheet
`nonce` are handled. Listener disposal is terminal until reconnect/rebind.
These implementations and iframe/modal regressions are written, not validated;
this is not a browser/APG or CSP certification.

### Menu acquisition ownership (candidate)

Repeated `createMenu` calls for the same element acquire independent, idempotent
leases over one underlying controller. Disposing one handle cannot dispose another
handle or a borrowed submenu. A parent releases only its submenu acquisition;
the last acquisition disposes the controller, while DOM removal closes all leases.
Conflicting triggers and duplicate-parent attachments are rejected. This addresses
menu acquisition specifically; full imperative/declarative ownership and option
parity across the other UI primitives remain part of #153 acceptance.

### Ownership continuation (candidate; no validation executed)

Closed controller owners ignore new DOM writes/listeners and immediately release
late cleanup acquisitions. Finalizers run after attribute restoration, even if a
cleanup throws. Floating controllers also watch trigger removal; queued geometry
observer callbacks become inert after cleanup. Opening/closing during initial
focus, geometry callbacks or focus restoration does not publish a stale open/close
transition. Dialog close events include `{reason:'api'|'esc'|'backdrop'}`.

Tooltip show/hide timers are cancelled by disposal and pending show by Escape;
`disabled` also applies to programmatic open. Multiple tooltip descriptions use
independent IDREF leases, and tooltip triggers do not acquire aria-expanded.
Popover `triggerOn` supports click/hover/focus/manual. Positioning accepts physical
sides with logical `-start`/`-end` alignment, including RTL; centering is the default
when no alignment is specified. Arrow styles owned by a popover restore on disposal.

Lazy tab callbacks are marked in-flight before entering user code, and a cleanup
returned after parent disposal releases immediately. Reentrant selections retain
the most recent selection rather than committing stale attributes. Accordions
isolate nested items, snapshot initial values, validate indices and support
non-native button keyboard semantics without double-activating native buttons.

Combobox rows use one delegated handler, so detached rows cannot mutate a former
controller. Closing cancels requests/debounce, and late results cannot reopen the
list. Direct search supersedes pending debounce; ArrowUp starts at the last enabled
option. Source options and original list children remain caller-owned.

Portal acquisitions for the same element/target share one original-position
marker. Only the final release restores position. A competing target or DOM realm
is rejected; restoration never steals an element moved by another owner. Geometry,
focus and portal constructors still require one live direct controller per surface
unless a documented acquisition API (menu/portal) explicitly shares it.

These changes do **not** complete #153 by themselves. Complete reactive/MaybeSignal
options, directive/schema/metadata tables and two-way values, date-picker calendar/
form/range parity, transitions/reduced-motion, full API alignment and final
browser/keyboard/axe/SSR/budget execution remain outstanding.

### Date picker contract (authored candidate)

`uiPlugin()` now opts the `zen-date-picker` tag into the App directive walker, so
`<zen-date-picker>` does not need a duplicate attribute. The optional Core directive
`tag` field uses an invalidated, App-owned index and deduplicates explicit attribute
bindings. Legacy runtime `ZenDatePicker`/`processDatePicker` bridges remain intact.
Registration occurs only in the owning browser realm, never during module import
or server processing. Multiple `processDatePicker` passes acquire separate leases;
only their final release stops the picker. Direct DOM disconnect also stops it.

```html
<zen-date-picker
  calendar="gregorian" locale="en-US" format="YYYY-MM-DD"
  value="2024-02-29" min="2024-02-01" max="2024-03-31"
  name="arrival" required
></zen-date-picker>
```

- `calendar`: jalali (default) or gregorian. Gregorian leap/date validation uses UTC
  civil dates, including years 1..99 without the JavaScript 1900-year shortcut.
  Jalali uses `@zenith/jalali` directly, with its supported calendar range.
- `locale`: explicit BCP-47 tag, inherited document language, then fa-IR/en-US for
  the selected calendar. Digits, labels and direction follow this locale; explicit
  `dir` overrides direction. `first-day` uses Sunday=0..Saturday=6, defaulting to
  6 for Jalali and 1 for Gregorian. Keyboard Home/End use the same week origin.
- `format`: YYYY/MM/DD by default. Exactly one YYYY, MM and DD token, in any order,
  separated by the same `/`, `-` or `.` character. Gregorian ISO YYYY-MM-DD is also
  accepted as input; set format="YYYY-MM-DD" for ISO output. Jalali Persian digits
  and the legacy completed `change` event remain supported. Changing calendar
  reinterprets value/min/max/exclusions in that calendar; it is not a conversion API.
- `disabled`, `readonly`, `required`, `range` use HTML boolean presence. Remove an
  attribute for false; a literal disabled="false" is still disabled. Programmatic
  false removes the owned attribute. Readonly prevents selection but allows browsing.
- `disabled-dates` is a schema-parsed JSON array, at most 4096 strings/262144 attribute
  characters. Malformed configuration/dates set validity errors and disable selection,
  rather than evaluating JSON or inserting unchecked HTML. No per-binder JSON parser.
- Range values are `start..end` in the configured format. First selection is `start..`
  (incomplete); reverse endpoint selection is sorted. An interval crossing an excluded
  date is not committed. Only complete available values are submitted.
- `input` and `zen-date-picker-change` bubble across shadow boundaries and include
  `{value,start,end,complete,calendar}`; legacy `change` fires for complete selections.
  Setting `.value` programmatically does not synthesize user change events.
- Native ElementInternals is preferred for form association/validity/state restoration.
  DOM implementations without that API get one owned, hidden text-input proxy, not
  a duplicate value. Name/form reassociation, disabled fieldsets/first-legend exception,
  required/readonly, reset and disconnect/reconnect are covered by authored fixtures.
  Fallback reset runs after event dispatch so a cancelled reset is respected.
- `.validity`, `.validationMessage`, `.willValidate`, `.form`, `.checkValidity()`,
  `.reportValidity()`, `.setCustomValidity()` and `.defaultValue` are exposed. Initial
  value at first connection is the reset baseline; defaultValue explicitly changes it.
  Disposal releases listeners, observers and submitted form value without deleting
  the visible calendar markup. Methods become live again on a later connection.

`createDatePicker(element, options)` accepts readable/Signal options, validates via
`datePickerOptions`, owns only supplied attributes and restores them on disposal.
It returns `{element,value,setValue,focus,checkValidity,reportValidity,dispose}`.
Only one reactive configuration controller may own an element at a time; ordinary
processing leases can coexist. In SSR it configures attributes without registering
custom elements; these server methods do not claim browser form validation.

**Still unverified:** native form behavior, fallback parity, screen-reader month
announcements, all browser keyboard/axe cases and the full UI bundle budget. New
unit/Core/browser fixtures have been written, not executed. Metadata seed and grammar
were updated; regenerating/checking editor snapshots belongs to the final gate phase.

Tooltip interaction now retains independent trigger-hover, surface-hover and focus
intent. Leaving just one input does not dismiss an active tooltip; entering another
input does not restart an existing opening deadline. Trigger/surface crossings keep
one session. Escape (including the shared floating Escape layer) dismisses that
session until all inputs disengage; pending timers, outside closure and disposal
cannot resurrect it. Explicit `.open()` starts a manual session unless disabled.
Geometry reads for popovers do not mutate the arrow until the activation revision
has been rechecked, including synchronous disposal inside a DOM measurement hook.

The date-picker month live region stays connected through renders and changes only
when its announcement changes. Inherited language/direction mutations are observed;
locale-generated non-Latin digits round-trip through a bounded, pure locale map.
These changes have authored regression/browser fixtures but no executed evidence yet.

### Collection configuration and directive values (unvalidated candidates)

`tabsOptions`, `accordionOptions`, `comboboxOptions`, `dialogOptions`,
`popoverOptions`, `tooltipOptions` and `menuOptions` now expose a common strict
schema resolver plus `DEFAULTS`/`schema`. Invalid enums, booleans, timer durations,
unknown option keys and malformed/duplicate combobox values are rejected before
controller DOM setup. Attribute readers use the shared schema engine too: explicit
`zen-…-multiple="false"` is false, unlike native HTML boolean attributes on Date Picker.

Tabs, accordion and combobox accept readable values for **each** configuration
field (callbacks are not invoked merely because they are functions). Their owners
stop option effects on disposal. Tabs can update orientation/manual activation,
controlled index and lazy parking without cloning authored nodes. Accordion can
update controlled arrays/multiple/collapsible; uncontrolled multi-selection narrows
to its first entry when multiple becomes false. `setValue` is silent for all three;
`select`/`toggle` remain user-selection operations with canonical change events.
Changing a source and its controlled selection in the same batch is supported by
one combobox options snapshot. Invalid selections still produce ZEN-1603 rather
than silently picking a different item.

```html
<section zen-tabs="$selected" zen-tabs-activation="manual">…</section>
<div zen-accordion="$expanded" zen-accordion-multiple="true">…</div>
<div zen-combobox="$city" zen-combobox-options="$cities"
     zen-combobox-option-label="title" zen-combobox-option-value="code"
     zen-combobox-filter="startsWith" zen-combobox-debounce="250ms">
  <label for="city">City</label><input id="city"><div zen-combobox-list></div>
</div>
```

- Dialog/popover open values, tabs index, accordion arrays and combobox selection
  have expression → controller and canonical event → writable directions. General
  expressions are readable, but writing is deliberately restricted to a directly
  named `get`/`set` container (including `$name`, lexical-local precedence). Computed
  values, nested expressions, literals and calls are never assigned/evaluated as
  code. Programmatic sync does not echo a user-selection event.
- Combobox uses separate **value** and **options** expressions. A single selection
  writes a string (empty string on clear), multiple selection writes a string array.
  Option projections traverse only safe own properties. `contains`, `startsWith`
  and `none` are the supported filter modes. `zen-combobox-async` names a loader
  `(query, signal) => Promise<rows>`; source replacement and unmount abort obsolete
  requests, and stale results cannot replace the active list. Async work starts on
  search/input, not plugin import. IME input/keys are respected.
- `zen-tooltip="textExpression"` uses tracked text content, not HTML, and restores
  the original authored nodes at teardown. The combined hover/focus contract above
  still owns its visibility/timers.
- Dialog directives portal to body by default (`zen-dialog-portal` selects another
  target); direct programmatic `createDialog` does not automatically move elements.
  Portal cleanup runs after dialog cleanup; server rendering never moves the root.
- Registration metadata is attached to all seven directive definitions; their seed
  and grammar tables match the authored attribute contract. Generated editor/API
  snapshots are still deferred to the final generation/check phase.

**Validation status:** surface reconfiguration and shared motion are now implemented
candidates (see below), not validated contracts. Borrowed-menu configuration/API review and tooltip-text/arrow composition still need
implementation decisions or follow-up. No size, browser, keyboard, type, schema or
accessibility results are claimed here.

Generic portals now register their original logical ancestry with the floating/modal
scope, not only physical destination. Same-target leases share that branch until
final release. Removing the original source subtree restores content into that
(detached) subtree so a body-level controller can clean itself up; removing the
destination restores into the source. External reparent/removal is respected and
never resurrected. Restoration occupies its cache through custom-element reconnect
callbacks and still releases logical ancestry if another cleanup fails. Authored
fixtures cover generic portal focus/inert/outside boundaries and App subtree removal;
full browser/custom-element reentrancy evidence remains deferred.


### Reactive surfaces and CSS motion (unvalidated candidate)

Dialog, popover, tooltip and menu expose concrete `*Config` types and mapped
`*Options` accepting values or `get()` readables. Reconfiguration keeps the same
controller/state rather than manufacturing close/open events. Dialog can change
modal, focus, scroll and portal policies while open; the original return-focus
origin is retained. Portal changes suspend the old focus/modal leases before moving
the root. Floating surfaces rebind the current trigger and release obsolete geometry,
listeners, IDREFs and watched-node leases. Menu trigger ARIA has one writer (popover),
so replacement/disposal cannot restore another layer's stale snapshot.

Directive option values are literals by default. Prefix a scalar option with `:`
to read an expression through the existing, CSP-safe expression engine. The controller
owns that readable subscription. Boolean existence/`false` and duration literals keep
their previous meaning; absent/undefined expressions use the documented fallback.
The main widget value remains its normal unprefixed expression.

```html
<section zen-dialog="$open" zen-dialog-modal=":$modal"
         zen-dialog-portal=":$destination" zen-dialog-transition="fade"
         zen-dialog-transition-duration="200ms">…</section>
<div zen-popover="$visible" zen-popover-trigger=":$anchor"
     zen-popover-placement=":$placement" zen-popover-offset=":$gap">…</div>
<section zen-tabs="$selected" zen-tabs-lazy=":$lazy">…</section>
```

`zen-dialog-portal="false"` disables automatic portalling; the programmatic `portal`
option accepts `false`, an element or a selector, including a readable of those values.
Standalone `createPortal` now accepts a readable target too (see below). Menu leases retain the
first controller's configuration source; borrowing does not merge or replace that
source. All supplied fields now have conflict/source checks (see the candidate
policy below), not just the trigger. This compatibility policy needs review.

All seven show/hide widgets now accept `transition?: string | false` and
`transitionDuration?: number` (default 300ms). Their corresponding
`zen-<widget>-transition` / `zen-<widget>-transition-duration` attributes are schema
parsed. Omitted names inherit `zen-transition`; `false` disables motion. Collection
root names apply to panels/listboxes; without a root name, a panel's own
`zen-transition` can opt in. No stylesheet is injected: consumers supply CSS using
the name class plus `zen-enter-*` / `zen-leave-*` classes from `@zenith/transition`.
For example:

```css
.fade.zen-enter-active, .fade.zen-leave-active { transition: opacity 200ms; }
.fade.zen-enter-from, .fade.zen-leave-to { opacity: 0; }
```

Closing updates logical state and immediately makes the outgoing node inert and
ARIA-hidden; only physical `hidden` waits for leave completion. Focus/modal/geometry
leases do not survive the logical close. Reopening cancels the previous leave,
reduced-motion changes finish pending motion, configuration changes cancel obsolete
runs, and disposal restores owned attributes/classes. Opening clears closed SSR
visibility attributes; it does not mistake those attributes for authored open-state
inertness. SSR skips animation/media setup. Date picker remains its inline calendar,
not an additional animated popup. Disabling lazy tabs binds newly revealed parked
children. Browser, type and unit fixtures are authored, **not executed**.


### Reactive generic portal ownership (candidate; fixtures unrun)

`createPortal(el, { target })` accepts a concrete selector/element or a readable of
those values. `portalOptions` is its strict resolver; `PortalConfig` names the
concrete shape. The initial origin marker and logical ancestry survive target
changes, so final release restores the original sibling position, not an intermediate
destination. A failed append attempts rollback without reclaiming externally moved
content. Source/destination removal, shadow-root destinations, synchronous reconnect
release and explicit SSR no-op have authored fixtures.

Same-source or concrete-current-target acquisitions share this lifetime. The first
readable owns target changes. A different readable is rejected with ZEN-1604 even if
its initial value matches: a second source is never silently ignored. Final release
stops the effect and observers. A source/target removal that ends the portal also
stops future moves; an old lease cannot tear down a newer acquisition. Explicit SSR
keeps the authored position and allocates no marker, observer or option effect.

### Tooltip expression content and authored arrows (candidate)

A nonempty `zen-tooltip` expression owns the tooltip's text presentation, not its
child node identities. Its value is inserted as literal text, never parsed as HTML.
The authored fallback stays structurally connected but hidden/inert while projected;
its nested directives are not mounted. The selected `zen-tooltip-arrow` branch
remains connected and decorative (`aria-hidden`, inert). Selectors can therefore
switch between authored arrows reactively without replacing SVG/path nodes.
Selected arrow styles, including an authored `display:…!important`, coexist with
Popover's geometry variables. Empty-expression `zen-tooltip` keeps authored content
and normal child bindings instead of claiming text ownership.

The surface disposes before content restoration. Final disposal, node/trigger
removal, and failed initial setup restore original authored text, attributes and
inline style strings. The projection owns descendant inline presentation for this
lifetime; concurrent outside mutation of those owned styles is not merged at
teardown. A custom UI host must implement `BindContext.skipChildren` for expression
content. Hosts lacking that capability fail before mutation with ZEN-1603; they can
still bind authored-content tooltips and the other widgets. The hook is an additive
Core API proposal requiring API-report/release review, not an API-identical #40
refactor. Unit, type and browser fixtures are written but not run.

### Shared Menu configuration sources (candidate)

The first controller for an element owns its configuration for the whole shared
lifetime, even after its first lease is released. Additional `createMenu` calls may
omit options, supply concrete values matching the **current** configuration, or
reuse identical readable objects for each supplied field. Different readables fail
with ZEN-1603 even if their initial values match; conflicting concrete configuration
also fails instead of being silently ignored. Triggers may be the same element or a
selector resolving to it; invalid/different concrete triggers fail with ZEN-1601.
Readables are checked by identity even when a source update is still queued.
Borrowers do not freeze future owner updates or acquire a second set of listeners.

A newly created submenu inherits its parent's live behavior options, with a manual
trigger and lateral placement. Attaching a parent to an already configured child
borrows that child's own sources rather than replacing them with inherited defaults.
The directive binder passes only attributes actually authored on the element, so a
bare `zen-menu` on an inherited child does not manufacture conflicting defaults.
Explicit child attributes are subject to the same source/value conflict checks;
configure a separately owned child before attaching a parent when it requires
independent sources. Release every lease to restore the authored tree and allow a
new configuration source. This policy is a compatibility change proposal subject to
API/acceptance review; the source-ownership fixtures have not been executed.


The date-picker shadow stylesheet receives its nonce **before** DOM insertion.
Changing nonce replaces that sheet with a newly authorized sheet rather than
mutating the nonce of an already connected sheet; the month announcer remains
connected. CSP-header/browser and nonce-rotation fixtures are authored but unrun;
this does not claim general CSP/Trusted Types compliance for unrelated surfaces.
Fixed-role Tooltip/Menu options accept only `tooltip`/`menu`; inconsistent roles
are rejected by both types and strict runtime schemas instead of being ignored.
