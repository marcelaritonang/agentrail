# NPM release checklist

AgentRail should publish scoped packages only after the package graph is registry-safe and the maintainer is authenticated with npm.

## Current status

- Available today: source checkout + local Docker setup from this repository.
- NPM target: `@agentrail/sdk` for application instrumentation and `@agentrail/mcp` for Codex-style trace lookup.
- Package state: publish-ready. `pnpm pack` produces registry-safe tarballs for `@agentrail/contracts`, `@agentrail/db`, `@agentrail/sdk`, and `@agentrail/mcp`; local npm tarball install smoke tests pass.
- Publish blocker: npm authentication and ownership of the selected `@agentrail` scope.
- `npm whoami` returns `ENEEDAUTH` on the current machine.
- The unscoped `agentrail` package is owned by another maintainer and must not be used.
- `@agentrail/sdk` and `@agentrail/mcp` are not published on the public registry yet.
- Source manifests use exact workspace dependencies such as `workspace:0.1.0`; `pnpm pack` and `pnpm publish` rewrite those to `0.1.0` in registry tarballs.
- Known advisory: the current `@modelcontextprotocol/sdk@1.29.0` dependency pulls `@hono/node-server` in the affected `<2.0.5` range even though AgentRail uses stdio MCP, not Hono static serving. Recheck this before a public announcement.

## Release blockers

1. Authenticate npm with an account that owns the selected scope.
2. Confirm whether the public scope is `@agentrail` or a maintainer-owned scope such as `@marcelaritonang`.
3. Publish all required dependency packages in order: `@agentrail/contracts`, `@agentrail/db`, `@agentrail/sdk`, then `@agentrail/mcp`.
4. Verify with `npm view <package>` before advertising commands as live downloads.

## Publish commands

Run from the repository root after `npm whoami` succeeds:

```bash
pnpm --filter @agentrail/contracts publish --access public --no-git-checks
pnpm --filter @agentrail/db publish --access public --no-git-checks
pnpm --filter @agentrail/sdk publish --access public --no-git-checks
pnpm --filter @agentrail/mcp publish --access public --no-git-checks
```

Use `pnpm publish`, not raw `npm publish`, because pnpm rewrites exact workspace dependencies to registry versions in the packed manifest.

## Intended commands after publish

```bash
# Target command after registry publish
npm install @agentrail/sdk

# Target MCP reader command after registry publish
npx @agentrail/mcp
```

Until publish is complete, website and README copy must describe these commands as a package release target, not as a live registry guarantee.
