# Security Policy

## Supported status

AgentRail is an early Milestone 1 open-source build. No release is currently represented as production-ready or covered by an uptime, compliance, or security certification commitment.

## Reporting a vulnerability

Use the repository's private security-advisory or private vulnerability-reporting channel when it is available. If that channel is unavailable, contact a maintainer privately through the account that publishes this repository before sharing technical details.

Do not open a public issue containing API keys, raw trace payloads, database URLs, cloud credentials, exploit steps, or other secrets. Include the affected commit, impact, minimal reproduction, and suggested mitigation in the private report.

## Secret handling

- Raw API keys are shown once during local bootstrap and are not stored in PostgreSQL.
- `.agentrail/` and `.env*` are ignored, but their contents must still be treated as secrets.
- Synthetic `SAMPLE DATA` is the only data intended for public demos.
- Rotate any credential immediately if it appears in a commit, issue, log, screenshot, or build artifact.
