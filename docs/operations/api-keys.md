# API-Key Operations

AgentRail local keys use an `ar_local_` prefix followed by 32 random bytes encoded as hexadecimal. Hosted environments should use a distinct environment prefix.

## Storage model

The raw key is presented to the operator once. The database stores:

- a short prefix used to locate a candidate row;
- an HMAC-SHA-256 digest derived with `API_KEY_PEPPER`;
- project ownership, creation time, and optional revocation time.

The pepper is application secret material and must not be stored beside the database. Authentication compares fixed-length digest bytes with a timing-safe function.

## Local creation

`pnpm bootstrap:local` creates a project/key and submits synthetic data. It writes local state under `.agentrail/` so the smoke test can reuse the key. That directory is Git-ignored but is not safe to share.

## Rotation

1. Create a new random key with a new API-key row.
2. Deliver the raw value through an approved secret channel.
3. Confirm ingestion with the new key.
4. Set `revoked_at` on the old row.
5. Search private logs and build artifacts for accidental disclosure.

Rotate `API_KEY_PEPPER` through an explicitly planned migration because existing digests depend on it. A blind pepper replacement invalidates every active key.

## Incident response

Revoke a suspected key immediately. Do not paste it into an issue, chat transcript, screenshot, command history, or CI log. In AWS, store the pepper and database credentials in Secrets Manager or an equivalent managed secret store; do not bake them into images.
