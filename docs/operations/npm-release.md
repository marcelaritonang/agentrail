# NPM release checklist

AgentRail should publish scoped packages only after the package graph is registry-safe and the maintainer is authenticated with npm.

## Current status

- Available today: source checkout + local Docker setup from this repository.
- Published on npm: `@agentrail-sdk/contracts@0.1.1`, `@agentrail-sdk/db@0.1.0`, `@agentrail-sdk/sdk@0.1.0`, `@agentrail-sdk/context@0.1.1`, `@agentrail-sdk/cli@0.1.1`, and `@agentrail-sdk/mcp@0.1.1`.
- NPM target: `@agentrail-sdk/sdk` for application instrumentation, `@agentrail-sdk/cli` for local Context Packs, and `@agentrail-sdk/mcp` for Codex-style trace lookup.
- Package state: `pnpm pack` produces registry-safe tarballs for all publishable packages; local npm tarball install smoke tests pass.
- Remaining release action: publish `@agentrail-sdk/mcp@0.1.2` from an authenticated npm session before advertising the MCP Context profile through `npx`.
- The unscoped `agentrail` package is owned by another maintainer and must not be used.
- Source manifests use exact workspace dependencies such as `workspace:0.1.0`; `pnpm pack` and `pnpm publish` rewrite those to `0.1.0` in registry tarballs.
- Runtime npm audit is expected to be clean before public announcement. Do not paste npm tokens into chat; create a short-lived token locally if CLI publishing needs one.

## Release blockers

1. Authenticate npm with an account that has write access to the `@agentrail-sdk` organization.
2. Confirm `npm org ls agentrail-sdk` shows the maintainer account before publishing.
3. Publish all required dependency packages in order: `@agentrail-sdk/contracts`, `@agentrail-sdk/db`, `@agentrail-sdk/context`, `@agentrail-sdk/sdk`, `@agentrail-sdk/cli`, then `@agentrail-sdk/mcp`.
4. Verify with `npm view <package>` before advertising commands as live downloads.

## Publish commands

Run from the repository root after `npm whoami` succeeds:

```bash
pnpm --filter @agentrail-sdk/contracts publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/db publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/context publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/sdk publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/cli publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/mcp publish --access public --no-git-checks
```

Use `pnpm publish`, not raw `npm publish`, because pnpm rewrites exact workspace dependencies to registry versions in the packed manifest.

## Live commands

```bash
npm install @agentrail-sdk/sdk

npm install -D @agentrail-sdk/cli
npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json

npx -y @agentrail-sdk/mcp
```

The MCP Context profile command below is valid for source checkout today and valid through `npx` only after `npm view @agentrail-sdk/mcp version` returns `0.1.2`:

```bash
npx -y @agentrail-sdk/mcp --profile context
```
