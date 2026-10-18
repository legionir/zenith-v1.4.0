---
'@zenith/compiler': patch
---

Serialize directive expression strings into generated text/if/show/html/trusted
render code instead of referencing compiler-local dir.value at runtime. Add
executed generated-render tests for expression updates, sanitizer routing,
class/boolean bindings and strict/runtime fallback. Retain all coverage gates.
