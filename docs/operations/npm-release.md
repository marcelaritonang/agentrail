# NPM release checklist

AgentRail should publish scoped packages only after the package graph is registry-safe and the maintainer is authenticated with npm.

## Current status

- Available today: source checkout + local Docker setup from this repository.
- NPM target: `@agentrail-sdk/sdk` for application instrumentation and `@agentrail-sdk/mcp` for Codex-style trace lookup.
- Package state: publish-ready. `pnpm pack` produces registry-safe tarballs for `@agentrail-sdk/contracts`, `@agentrail-sdk/db`, `@agentrail-sdk/sdk`, and `@agentrail-sdk/mcp`; local npm tarball install smoke tests pass.
- Publish blocker: maintainer must publish from an authenticated npm session that has write access to the `@agentrail-sdk` organization.
- The unscoped `agentrail` package is owned by another maintainer and must not be used.
- `@agentrail-sdk/sdk` and `@agentrail-sdk/mcp` are not published on the public registry yet.
- Source manifests use exact workspace dependencies such as `workspace:0.1.0`; `pnpm pack` and `pnpm publish` rewrite those to `0.1.0` in registry tarballs.
- Runtime npm audit is expected to be clean before public announcement. Do not paste npm tokens into chat; create a short-lived token locally if CLI publishing needs one.

## Release blockers

1. Authenticate npm with an account that has write access to the `@agentrail-sdk` organization.
2. Confirm `npm org ls agentrail-sdk` shows the maintainer account before publishing.
3. Publish all required dependency packages in order: `@agentrail-sdk/contracts`, `@agentrail-sdk/db`, `@agentrail-sdk/sdk`, then `@agentrail-sdk/mcp`.
4. Verify with `npm view <package>` before advertising commands as live downloads.

## Publish commands

Run from the repository root after `npm whoami` succeeds:

```bash
pnpm --filter @agentrail-sdk/contracts publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/db publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/sdk publish --access public --no-git-checks
pnpm --filter @agentrail-sdk/mcp publish --access public --no-git-checks
```

Use `pnpm publish`, not raw `npm publish`, because pnpm rewrites exact workspace dependencies to registry versions in the packed manifest.

## Intended commands after publish

```bash
# Target command after registry publish
npm install @agentrail-sdk/sdk

# Target MCP reader command after registry publish
npx @agentrail-sdk/mcp
```

Until publish is complete, website and README copy must describe these commands as a package release target, not as a live registry guarantee.
