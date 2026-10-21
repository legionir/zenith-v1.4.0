# Security Policy

## Supported versions

| Version  | Supported          |
| -------- | ------------------ |
| 1.4.x    | ✅ active          |
| < 1.4    | ❌ EOL (upgrade)   |

Security fixes are released for the current minor line only. Minimum runtime:
**Node ≥ 18.19** (see `docs/decisions/DEC-007-node-floor.md`) — vulnerabilities
that only affect older unsupported Node runtimes are not patched.

## Reporting a vulnerability

**Preferred:** GitHub **Private vulnerability reporting** on this repository —
open the **Security** tab → *Report a vulnerability*. This creates a private
draft advisory between you and the maintainers; nothing is public until a fix
is agreed.

**Fallback (while private reporting is being enabled on the repo):** email
**security@zenith-framework.dev** with the word `ZENITH-SEC` in the subject
(owners should confirm/replace this address — see `docs/MANUAL-STEPS.md`).
Do **not** open a public issue.

### What to include

- affected package(s) (`@zenith/*`) and version,
- reproduction steps / proof-of-concept (a failing test or snippet is ideal),
- impact assessment (what an attacker gains),
- any known mitigations.

## Response times

| Milestone                                  | Commitment        |
| ------------------------------------------ | ----------------- |
| Acknowledgement of the report              | **48 hours**      |
| Initial assessment (confirmed / not a vuln)| 7 days            |
| Fix shipped + advisory published           | **90 days** max disclosure; shorter when feasible |

If the issue is being actively exploited we aim to patch well under 90 days.
Reporters who wish to be credited are named in the GHSA advisory.

## Scope

**In scope**

- the 35 published `@zenith/*` packages and `zenith-vscode` (runtime behavior:
  XSS via sanitizers/`zen-html`, expression-engine sandbox escapes, SSRF-ish
  fetch/data handling, service-worker cache poisoning, prototype pollution in
  store/state, injection in compiler-generated code, auth/permission bypass),
- the build/CLI surface when reachable from untrusted input
  (`zenith create` template traversal is a known fixed class — regressions are
  in scope).

**Out of scope**

- social engineering of end users,
- vulnerabilities in third-party dependencies *already covered by an upstream
  advisory* (we track those via `npm audit` in CI and Dependabot — see #65),
- the demo apps under `demos/` / `ecommerce-demo/` (they intentionally contain
  XSS sample fixtures and mock backends),
- anything requiring physical access to a developer machine.

## Notes for developers

- CI blocks known high/critical advisories in the **production** dependency
  tree on every push (`Dependency audit` job, #79).
- The expression engine (`@zenith/expressions`) is a security boundary: new
  syntax must go through the validator's forbidden-property list — treat
  changes there as security-relevant reviews.
