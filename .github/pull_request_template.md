## What and why

<!-- What does this change, and why? Link the issue it closes. -->

## Checks

- [ ] `pnpm verify` passes (and `pnpm verify --e2e` if the web app changed)
- [ ] Tests added or updated; for payment logic, the failing test came first
- [ ] Amounts stay integer base units; chain values stay in `packages/chains`
- [ ] No invariant (I1–I7, C1, S1–S4) weakened; no secrets or keys in the diff
