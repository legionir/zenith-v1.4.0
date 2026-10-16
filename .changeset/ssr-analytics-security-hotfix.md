---
'@zenith/ssr': patch
'@zenith/runtime': patch
'@zenith/errors': patch
---

Use a fresh cryptographic CSP nonce per adapter response and support {{nonce}} in
custom policies. Propagate request cancellation through async state and SSR
prepass without late DOM/App work or writes to disconnected Node responses.

Handle both synchronous analytics provider throws and rejected send promises;
report sanitized ZEN-1901 without raw exception, provider identity or event data.
