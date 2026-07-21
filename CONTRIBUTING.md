# Contributing to AgentRail

AgentRail welcomes focused issues and pull requests that preserve the forensic product boundary in the Milestone 1 specification.

## Development setup

1. Install Node.js 24 and Docker.
2. Enable Corepack and run `pnpm install`.
3. Start dependencies and apps with `docker compose up -d --build`.
4. Run `pnpm bootstrap:local` to create isolated `SAMPLE DATA`.
5. Run the quality gates before opening a pull request.

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Integration tests expect PostgreSQL on port 5433, Redis on 6379, and S3-compatible MinIO on 9000. The database integration test is guarded to use only a URL ending in `/agentrail_test`.

## Change discipline

- Add behavior through red-green-refactor tests.
- Keep the ingestion request path limited to auth, bounds/schema validation, canonicalization, and one queue enqueue.
- Never add a separate event ID as an idempotency key. The key is `(project_id, span_id)`.
- Keep authoritative cost calculation in the worker.
- Unknown pricing stays nullable; never default it to zero.
- Never expose blob credentials, raw storage keys, or direct evidence URLs to the browser.
- Do not commit `.env`, `.agentrail`, benchmark output, screenshots containing secrets, or real customer traces.

For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
