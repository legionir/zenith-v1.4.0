---
'@zenith/ssr': minor
'@zenith/expressions': minor
'@zenith/errors': patch
---

#56: give host-integration and parser internals a canonical home without
removing legacy root names. New `@zenith/ssr/internal` (ALS/DOM isolation:
domAls, getDOMGlobals, installDOMGlobalGetters, context stores, runtime env)
and `@zenith/expressions/internal` (lex, TokenType, Token, Parser) subpaths;
origins classified at their real `@internal` level; root names stay as
classified compatibility bridges until removal is approved (2.0).

Deprecate the legacy same-name `@zenith/ssr` `hydrate(root, initFn?)` bridge
in favor of the canonical public `hydrate(root, init?)` from
`@zenith/runtime-core` (once-only ZEN-DEPR-108; removal in 2.0). No behavior
change; no generated API report or validation result is claimed.
