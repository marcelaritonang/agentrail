# NPM release checklist

AgentRail should publish scoped packages only after the package graph is registry-safe and the maintainer is authenticated with npm.

## Current status

- Available today: source checkout + local Docker setup from this repository.
- NPM target: `@agentrail/sdk` for application instrumentation and `@agentrail/mcp` for Codex-style trace lookup.
- Publish blocker: npm authentication, scope ownership, and registry-safe package dependencies.
- `npm whoami` returns `ENEEDAUTH` on the current machine.
- The unscoped `agentrail` package is owned by another maintainer and must not be used.
- `@agentrail/sdk` and `@agentrail/mcp` are not published on the public registry yet.
- `packages/sdk` and `packages/mcp` are still marked `private: true`.
- `packages/sdk` depends on the workspace package `@agentrail/contracts`.
- `packages/mcp` depends on the workspace package `@agentrail/db`.

## Release blockers

1. Authenticate npm with an account that owns the selected scope.
2. Decide whether the public scope is `@agentrail` or a maintainer-owned scope such as `@marcelaritonang`.
3. Publish all required dependency packages or bundle internal packages so npm consumers do not receive unresolved `workspace:*` dependencies.
4. Remove `private: true` only when package contents, exports, files, and licenses have been reviewed.
5. Verify with `npm pack --dry-run` and `npm view <package>` before advertising commands as live downloads.

## Intended commands after publish

```bash
# Target command after registry publish
npm install @agentrail/sdk

# Target MCP reader command after registry publish
npx @agentrail/mcp
```

Until publish is complete, website and README copy must describe these commands as a package release target, not as a live registry guarantee.
