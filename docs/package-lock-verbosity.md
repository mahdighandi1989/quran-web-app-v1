# Why `package-lock.json` is large and verbose (task 5e99a172)

A static "over-engineering" scan flagged `package-lock.json` (around line 15) for its
exhaustive list of platform-specific optional dependencies — for example every
`@esbuild/*` target (`@esbuild/aix-ppc64`, `@esbuild/android-arm`, `@esbuild/darwin-arm64`,
`@esbuild/linux-x64`, `@esbuild/win32-x64`, and the rest).

This is **not** an anti-pattern to "fix". It is the documented, intended behavior of
npm and must be left in place. This justification is recorded here (instead of inside
the JSON, which cannot hold comments) so the file is not "cleaned up" by mistake.

## Justification (do not strip optional dependencies)

This package-lock.json verbosity is expected due to lockfileVersion: 3. The lockfile
records the *entire* resolved dependency graph, including optional platform-gated
packages, so that an install is byte-for-byte reproducible on any operating system or
CPU architecture — not only the one that generated the lock.

In other words: npm lockfileVersion 3 includes all optional dependencies for
cross-platform reproducibility. Tools such as `esbuild` (pulled in by Vite) ship a
separate prebuilt native binary per platform and expose them as `optionalDependencies`.
npm resolves and pins *all* of them in the lockfile, then installs only the one that
matches the current host at install time. If we hand-edited the lockfile to remove the
"unused" entries:

- `npm ci` on a different OS/arch (Linux CI vs. macOS/Windows dev machines, or
  arm64 vs. x64) would be unable to find the correct prebuilt binary and would fail
  or silently fall back, breaking the build.
- `npm install` would simply regenerate every removed entry on the next run, so the
  edit is pure churn.

## What to do instead

Treat the size as expected. Do not delete optional-dependency entries by hand. If the
lockfile ever needs regeneration, delete it and run `npm install` so npm rebuilds the
full, correct graph. The edge-case test `tests/test_anti_pattern_edge_case.py`
guards that the committed lockfile stays valid JSON, stays at `lockfileVersion: 3`, and
keeps its optional dependencies — i.e. that nobody "optimizes" the verbosity away.
