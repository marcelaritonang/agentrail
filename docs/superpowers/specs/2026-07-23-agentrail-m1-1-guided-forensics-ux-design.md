# AgentRail M1.1 Guided Forensics UX Design Specification

**Status:** Direction approved; written specification awaiting review

**Date:** 2026-07-23

**Parent specification:** `2026-07-21-agentrail-m1-design.md`

**Product position:** The flight recorder for AI agents

## 1. Decision Summary

AgentRail remains an open-source observability and forensic recorder for teams
that build AI agents. M1.1 does not turn it into a consumer workflow runner.

The approved direction adds a plain-language orientation and investigation
layer above the existing forensic dashboard:

1. Explain what the page is for and where recorded runs come from.
2. Summarize each run in language a technical-adjacent stakeholder can
   understand.
3. Present the sequence of recorded steps before exposing trace internals.
4. Keep Trace Rail, Action Ledger, identifiers, attributes, and payload JSON
   available through progressive disclosure.
5. Show only actions supported by the current product.

The design principle is:

> Human-readable summary first; forensic evidence second.

The dashboard retains the approved graphite, warm-white, amber, cyan, violet,
and red visual identity. M1.1 changes information hierarchy, terminology,
affordance, onboarding, and readability. It does not replace the dashboard
with a generic SaaS card grid.

## 2. Objective and Success Criteria

### 2.1 Objective

A first-time visitor who has never used an AI-agent observability tool must be
able to understand the public demo within 30 seconds:

- AgentRail records runs performed by an instrumented AI-agent application.
- The current page lists those recorded runs; it does not start new ones.
- The sample run succeeded.
- The run contains three operational steps and one root trace record.
- One step called an AI model and one performed an external action.
- Recorded input/output data is available only where capture was enabled.
- Technical evidence remains available for deeper investigation.

### 2.2 Measurable acceptance criteria

The M1.1 UX is accepted when all of the following are true:

1. The `/traces` page visibly answers what it is, what users can do, what to
   click first, and where runs come from without opening another page.
2. The public sample exposes one primary action labeled
   `Explore the sample run`.
3. The detail page states outcome, duration, step count, external-action
   count, agent identity, requester identity, and model cost before Trace Rail.
4. Every recorded span appears in a readable step sequence with a plain
   category label.
5. A span without captured payload never offers an evidence action that opens
   an empty drawer.
6. Technical identifiers remain accessible without being the primary title.
7. The read-only synthetic-demo context is visible on desktop and mobile.
8. All loading, empty, filtered-empty, error, not-found, incomplete, unpriced,
   redacted, truncated, absent-evidence, and evidence-error states have
   purpose-specific copy.
9. No action implies that AgentRail can execute, repeat, duplicate, share,
   export, or delete a workflow.
10. The public landing quickstart matches the implemented SDK and repository
    state.
11. Invalid or unconfigured source links are not rendered.
12. Desktop and 390 px mobile E2E, keyboard, reduced-motion, and WCAG AA checks
    pass.

## 3. Users and Jobs to Be Done

### 3.1 Primary user

**AI-agent developer or small engineering team**

When an agent fails, runs slowly, costs more than expected, or performs an
unexpected action, the developer needs to find the responsible step and inspect
the evidence recorded for it.

### 3.2 Secondary users

**Engineering lead, founder, product manager, operations reviewer, or security
reviewer**

These users need to determine:

- whether a run succeeded;
- which agent acted and who requested the work;
- how long the run took and what the model calls cost;
- which external actions occurred;
- which inputs or outputs are available for review.

They should not need to understand spans, trace IDs, payload references, or
waterfall geometry before answering those questions.

### 3.3 Evaluation audience

**Open-source evaluator, AWS reviewer, potential partner, or early adopter**

This audience needs evidence that AgentRail is a functioning product with a
coherent use case, a real ingestion and persistence pipeline, honest security
boundaries, working documentation, and a useful demo.

### 3.4 Explicit non-user

M1.1 does not target a consumer who expects to build, start, schedule, or rerun
AI workflows inside AgentRail. The “non-technical user” requirement is a
clarity benchmark for technical-adjacent stakeholders, not a change to the
ideal customer profile.

## 4. Current UX Audit

| Severity | Current problem                                                                              | User impact                                                        | M1.1 response                                                                             |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| P0       | Landing quickstart does not match the implemented SDK API                                    | A developer copying it receives invalid guidance                   | Replace it with verified source-first setup and an SDK example copied from the tested API |
| P0       | `@agentrail/sdk` is private while the empty state recommends installing it from a registry   | The first action cannot succeed                                    | Point to the repository quickstart while the package remains private                      |
| P0       | Landing source links target a missing repository and dashboard source targets generic GitHub | The open-source claim is not verifiable                            | Configure one canonical source URL and omit the control when unset                        |
| P0       | Landing copy describes making an AWS application credible                                    | Product value appears subordinate to obtaining credits             | Replace grant-centric copy with customer problem and product value                        |
| P1       | `/traces` begins with internal recorder vocabulary                                           | First-time users cannot form a mental model                        | Add an orientation block and use `Agent runs` as the primary label                        |
| P1       | The public sample appears as `sample.research-answer` without context                        | The only available choice resembles internal test data             | Show `Research answer` as the display title and retain the identifier secondarily         |
| P1       | The detail page begins with forensic metadata                                                | Outcome and meaning are slower to find than implementation details | Add a factual run summary and `What happened` sequence before Trace Rail                  |
| P1       | Clickable Trace Rail rows lack visible instructional affordance                              | Users do not know that recorded data can be inspected              | Add helper text and payload-aware action labels                                           |
| P1       | Action Ledger offers `Inspect` for spans without payload                                     | The interaction ends in `No captured payload`                      | Render `Metadata only` without a link when `hasPayload` is false                          |
| P1       | `SAMPLE DATA` disappears in the current mobile header                                        | Mobile visitors can mistake synthetic data for user data           | Render a persistent read-only demo banner in page content                                 |
| P1       | Error copy exposes PostgreSQL operation as primary content                                   | Non-operators receive an instruction they cannot act on            | Use a human error message and move diagnostics into technical disclosure                  |
| P2       | Several labels render at 8–9 px                                                              | Readability and low-vision access suffer                           | Raise the metadata floor and preserve density through spacing and alignment               |
| P2       | README says the dashboard is a future stage                                                  | Public documentation contradicts the deployed product              | Update repository status and working-feature list                                         |
| P2       | Landing uses `Replay` although AgentRail does not replay work                                | Capability is overstated                                           | Rename the pipeline step to `Investigate`                                                 |

## 5. Product Language

The interface remains English in M1.1. Copy uses short sentences, active voice,
and concrete nouns. Technical terms can appear as secondary aliases.

| Current primary term     | M1.1 primary term               | Technical secondary term |
| ------------------------ | ------------------------------- | ------------------------ |
| Trace archive            | Agent runs                      | Traces                   |
| Trace                    | Run                             | Trace / Run ID           |
| Span                     | Step                            | Span                     |
| Actor                    | Agent                           | `agent_id`               |
| On behalf of             | Requested by                    | `on_behalf_of`           |
| OK                       | Succeeded                       | `ok`                     |
| Error                    | Failed                          | `error`                  |
| Trace Rail               | Technical timeline              | Trace Rail               |
| Temporal evidence        | Recorded sequence               | —                        |
| Action Ledger            | External actions                | Action Ledger            |
| Consequential operations | Tool calls and external changes | —                        |
| Evidence                 | Recorded data                   | Evidence                 |
| Payload                  | Recorded input/output           | Payload / JSON           |
| Retrieval                | Data lookup                     | `retrieval`              |
| LLM                      | AI model call                   | `llm`                    |
| Cost                     | Model cost                      | Catalog-based `cost_usd` |
| SAMPLE DATA              | Read-only example               | Synthetic sample         |
| Inspect                  | Inspect recorded data           | —                        |
| INCOMPLETE               | Incomplete recording            | `incomplete`             |
| UNPRICED                 | Price unavailable               | `UNPRICED`               |

Helper text is persistent. Tooltips may supplement helper text but may not be
the only explanation because they are difficult to discover and do not map
well to touch devices.

## 6. Information Architecture

### 6.1 Global navigation

The M1.1 dashboard navigation contains:

- AgentRail product mark linking to `/`;
- `Agent runs` linking to `/traces`;
- a visible `Read-only example` indicator when demo mode is active;
- `Source` only when a canonical public source URL is configured.

`M1 recorder` is removed from primary navigation. It may remain in repository
release notes but does not help product navigation.

The route paths remain `/traces` and `/traces/[traceId]`. This avoids breaking
existing links and keeps the underlying domain vocabulary stable while the UI
uses the more understandable word `run`.

### 6.2 Page hierarchy

```text
/
├── Product explanation
├── How AgentRail works
├── Verified local quickstart
└── Guided public-demo CTA

/traces
├── Read-only example banner, demo mode only
├── Page purpose and first action
├── Three-step usage orientation
├── Search and filters
└── Agent-run ledger

/traces/[traceId]
├── Back to all agent runs
├── Read-only example banner, demo mode only
├── Factual run summary
├── At-a-glance facts
├── What happened
├── Technical timeline / Trace Rail
├── External actions / Action Ledger
└── Recorded-data drawer for payload-bearing steps
```

There is no dashboard route for accounts, billing, teams, settings, workflow
creation, or execution in M1.1.

## 7. Presentation Architecture

M1.1 adds a deterministic presentation layer inside `apps/web`. It does not
change ingestion, queue, worker, PostgreSQL, blob storage, pricing, or the
canonical span envelope.

### 7.1 Run presentation model

The web layer maps existing `TraceListItem` and `TraceDetail` values into a
presentation model with these concepts:

- `displayTitle`;
- `technicalName`;
- `outcomeLabel`;
- `completionExplanation`;
- `durationLabel`;
- `modelCostLabel`;
- `stepCount`;
- `technicalSpanCount`;
- `externalActionCount`;
- `agentCount`;
- `isReadOnlyExample`.

The presentation model never overwrites persisted values. It changes only how
they are explained.

`technicalSpanCount` is the persisted `spanCount`. `stepCount` excludes the
single root trace span when `rootSpanId` is present. The web list read model
therefore exposes the already-persisted `rootSpanId` so the calculation is
deterministic without a new database query or migration. When `rootSpanId` is
absent, `stepCount` equals `technicalSpanCount` because the presentation layer
cannot prove that a root span exists.

### 7.2 Deterministic title rules

For the synthetic public trace, the display title is explicitly
`Research answer`.

For other traces:

1. Keep the original trace name as `technicalName`.
2. Split dots, underscores, and hyphens into spaces.
3. Collapse repeated whitespace.
4. Capitalize the first word without inventing a new business description.
5. If normalization produces an empty value, use `Unnamed agent run`.

The UI never claims a purpose, result, destination, or final output that is not
present in persisted data.

### 7.3 Factual run summary rules

The summary uses a fixed template based only on recorded fields:

`{stepCount} steps were recorded in {duration}. The agent performed
{externalActionCount} external action(s).`

When duration is unavailable:

`{stepCount} steps were recorded. The final duration is unavailable.`

When the trace is incomplete, the summary begins:

`This recording is incomplete.`

No model call, external service, final result, user intent, or causal
explanation is inferred. M1.1 does not use an LLM to generate summaries.

### 7.4 Readable step mapping

Each span is represented once in `What happened`:

| Span kind       | Plain category               |
| --------------- | ---------------------------- |
| `retrieval`     | Looked up data               |
| `llm`           | Called an AI model           |
| `action`        | Performed an external action |
| `tool`          | Called a tool                |
| `trace`         | Recorded the complete run    |
| any other value | Recorded a custom step       |

The persisted span name appears below or beside the category after safe
humanization. A span with `outcome = error` uses the plain outcome label
`Failed`, regardless of its kind. Outcome and duration remain visible without
relying on color.

### 7.5 Payload-aware actions

- `hasPayload = true` renders `Inspect recorded data`.
- `hasPayload = false` renders `Metadata only` as non-interactive text.
- Payload loading, redaction, truncation, absence, and errors remain truthful
  states in the drawer.
- The browser continues to fetch payload content only through the
  project-scoped backend route.
- M1.1 does not add direct object-store access or presigned browser URLs.

## 8. `/traces` Agent-Run Index

### 8.1 Desktop structure

```text
Global header

Read-only example
This example shows how a research agent handled one task.
[Explore the sample run]  [How AgentRail works]

Agent runs
Review what an AI agent did, how long it took, what it cost,
and which tools it used.

How to use this page
1. Choose a run  →  2. Open it  →  3. Inspect steps and recorded data

Search by run name or ID | Status | Agent | Apply filters

Research answer                                      Succeeded
sample.research-answer · research-agent
3 steps · 1.25 s · $0.0040                           [Open run]
```

The orientation is a single bordered rail, not a row of equal feature cards.
It uses one primary action.

### 8.2 Run ledger

The desktop index remains information-dense but changes the first-read order:

1. human-readable title;
2. outcome;
3. technical name and short ID;
4. agent and requester;
5. step count, duration, model cost, and start time;
6. visible `Open run` affordance.

The title and `Open run` lead to the same detail route. The row must not contain
multiple conflicting primary actions.

`Price unavailable` is the plain label for an unpriced run, with `UNPRICED`
available as the technical state. It is never displayed as zero cost.

### 8.3 Search and filters

- Search has a persistent label: `Search by run name or ID`.
- Outcome is labeled `Status` with `All`, `Succeeded`, and `Failed`.
- Actor is labeled `Agent` and uses `Agent name or ID` as helper text.
- The submit label is `Apply filters`.
- Active filters are reflected in the URL.
- The no-results state names the active-filter condition and offers
  `Clear filters`.

### 8.4 Demo behavior

When demo mode is active:

- the orientation banner is always visible;
- `Explore the sample run` links directly to the known synthetic trace;
- the banner states that the example is read-only and synthetic;
- the page does not imply that public visitors can ingest their own data;
- the source action follows the configured-source rule in section 13.2.

When demo mode is inactive, the sample banner and sample CTA are not rendered.

### 8.5 Mobile behavior

At 390 px:

- the read-only banner remains visible;
- page purpose appears before controls;
- the three-step orientation becomes a vertical sequence;
- filters are grouped under an accessible `Search and filters` disclosure;
- each run becomes a bordered ledger item rather than a horizontally clipped
  table;
- status, title, agent, steps, duration, and model cost are visible;
- `Open run` spans the available content width;
- technical identifiers wrap without page overflow.

## 9. `/traces/[traceId]` Run Detail

### 9.1 Header and summary

The page starts with:

- `Back to all agent runs`;
- the read-only example banner in demo mode;
- display title;
- outcome label;
- technical name and short Run ID;
- factual summary from section 7.3.

For the sample:

```text
Research answer                                      Succeeded
sample.research-answer · Run ID 8044491c…d889

3 steps were recorded in 1.25 s. The agent performed
1 external action.
```

### 9.2 At a glance

The fact strip uses these labels in this order:

1. Status
2. Agent
3. Requested by
4. Duration
5. Steps
6. Model cost

Technical field names may appear in accessible helper text or advanced
details, not as the primary labels.

### 9.3 What happened

`What happened` is the first investigation section. It displays every
operational span in stable chronological and parent-aware order. The root trace
span is displayed separately as the run boundary and remains present in the
technical timeline.

Each row shows:

- ordinal number for non-root steps;
- plain category;
- humanized persisted span name;
- outcome;
- duration;
- agent when it differs from the run's primary agent;
- `Inspect recorded data` only when payload is present;
- `Metadata only` otherwise.

The root trace appears as a compact run boundary instead of step number 1. No
span is discarded from the technical timeline.

### 9.4 Technical timeline

The section heading is:

```text
Technical timeline
Trace Rail · exact order, nesting, and duration of recorded steps
```

Trace Rail remains visible on desktop because it is core developer value. It
is preceded by the plain `What happened` section and no longer carries the
entire burden of explaining the run.

On mobile, the readable step sequence is primary. The waterfall remains below
it with the existing mobile stacking and no horizontal page overflow.

### 9.5 External actions

The section heading is:

```text
External actions
Action Ledger · tools or systems the agent called or changed
```

Each action shows:

- humanized operation name;
- technical action or tool kind;
- agent;
- outcome;
- time and duration;
- `Inspect recorded data` when payload exists;
- `Metadata only` when payload does not exist.

The section is not a mutation history editor. It does not offer rerun,
rollback, approve, delete, or retry actions.

### 9.6 Evidence drawer

The primary drawer label is `Recorded data`. `Evidence` remains the technical
secondary term.

The drawer contains:

1. step display name and technical span ID;
2. plain kind plus technical kind;
3. agent, start time, duration, model, token usage, and model cost when present;
4. redaction or truncation notice before data;
5. recorded input/output JSON;
6. an advanced metadata disclosure for raw attributes.

The existing close, Escape, focus trap, URL-stable selection, and restored
focus behavior remain required.

## 10. States and Error Handling

### 10.1 Index states

| State           | Primary copy                        | Required action                     |
| --------------- | ----------------------------------- | ----------------------------------- |
| Loading         | `Loading agent runs…`               | None; preserve page-purpose heading |
| First-run empty | `No agent runs recorded yet`        | Link to repository local quickstart |
| Filtered empty  | `No agent runs match these filters` | `Clear filters`                     |
| Error           | `We couldn't load agent runs`       | `Try again`                         |

The first-run empty state explains:

`Runs appear here after an instrumented application sends spans and the worker
persists them.`

It shows the supported local command `docker compose up -d --build`. When the
canonical source URL is configured, it also links to
`{sourceUrl}#local-quickstart`. It does not recommend installing
`@agentrail/sdk` from a registry while the package is private.

Database or storage diagnostics appear only inside an accessible
`Technical details` disclosure and never expose secrets.

### 10.2 Detail states

| State                       | Plain-language behavior                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| Complete and successful     | `Succeeded`                                                                |
| Complete and failed         | `Failed`                                                                   |
| Timed-out incomplete        | `Incomplete recording` with the configured timeout explanation             |
| Null outcome before timeout | No fabricated status badge; show `No final outcome has been recorded yet.` |
| Unknown pricing             | `Price unavailable` and technical `UNPRICED`                               |
| Not found                   | `Run not found` and `Back to all agent runs`                               |

The UI must not use `Running`, `Pending`, or `Live` as a synonym for a trace
with no final outcome.

### 10.3 Evidence states

| State           | Primary copy                                                   |
| --------------- | -------------------------------------------------------------- |
| Loading         | `Loading recorded data…`                                       |
| Available       | `Recorded input/output`                                        |
| Redacted        | `Sensitive fields were removed before storage.`                |
| Truncated       | `Recorded data was shortened at the configured capture limit.` |
| No payload      | `No input/output was captured for this step.`                  |
| Backend failure | `Recorded data couldn't be loaded.`                            |

An evidence API failure does not remove the rest of the run detail.

## 11. Visual and Interaction System

### 11.1 Preserved identity

M1.1 preserves:

- graphite background;
- warm-white primary type;
- amber for actions and primary investigation affordances;
- cyan for AI-model calls;
- violet for retrievals;
- red for failure;
- Instrument Sans and JetBrains Mono;
- small radii;
- 1 px separators;
- nearly no shadows;
- Phosphor as the only icon family.

The dashboard remains governed by the AgentRail forensic design contract. The
landing-only `design-taste-frontend` rules do not govern dashboard layout.

### 11.2 Readability

- Body and explanatory copy render at 14 px or larger.
- Interactive control labels render at 13 px or larger.
- Metadata labels render at 11 px or larger.
- Technical identifiers may use 11 px JetBrains Mono but must support 200%
  zoom and wrapping.
- Color contrast meets WCAG AA.
- Status is always conveyed by text in addition to color.

Density is preserved through alignment, separators, and restrained spacing
rather than unreadably small text.

### 11.3 Interaction rules

- Every interactive row has a visible text affordance.
- Focus indicators remain visible on graphite and drawer surfaces.
- Hover may change color, background, or opacity but never scale geometry.
- No `transition-all`, gradient, glassmorphism, glow, decorative loop, or
  tooltip-only instruction is introduced.
- Reduced motion disables nonessential transitions.
- Mobile touch targets are at least 44 by 44 CSS pixels where controls are
  isolated.

## 12. Landing and Documentation Corrections

### 12.1 Landing

M1.1 updates the existing landing without changing its approved section
architecture:

- `Open trace dashboard` becomes `Explore the guided demo`.
- `Replay` becomes `Investigate`.
- The quickstart uses commands and SDK calls that exist in the repository.
- While `@agentrail/sdk` is private, setup begins from the public source
  repository rather than a registry-install claim.
- Copy about making an AWS application credible is removed.
- Replacement copy explains the product value:
  `Run AgentRail locally, inspect recorded agent behavior, and keep sensitive
evidence under your control.`
- No fabricated customer, traction, funding, compliance, or AWS-deployment
  claim is added.

### 12.2 Canonical source URL

The web app reads one optional canonical public source URL from
`NEXT_PUBLIC_AGENTRAIL_SOURCE_URL`.

- When configured, landing and dashboard source controls use the same URL.
- When absent, source controls are omitted.
- A configured value must be an absolute `https://` URL. An invalid value fails
  configuration validation instead of silently rendering a broken link.
- `https://github.com` is never used as a fallback.
- The current missing `https://github.com/agentrail/agentrail` target is not
  hardcoded.
- Before an AWS Activate application is submitted, the deployment must be
  configured with a real public repository containing the licensed source and
  working local quickstart.

### 12.3 README

The README must:

- state that the ingestion pipeline, worker, SDK, forensic dashboard, guided
  sample, and landing are implemented M1 capabilities;
- stop calling the dashboard a future implementation stage;
- retain the honest non-production and non-funding disclaimer;
- keep the working Docker quickstart;
- explain that the public Vercel deployment is a read-only synthetic demo.

## 13. Unsupported Features and Non-Goals

M1.1 does not include:

- `Run again` or `Duplicate workflow`, because AgentRail does not own workflow
  definitions or execution;
- `Share`, because there is no authentication, access policy, or share-token
  model;
- `Delete`, because cross-store deletion, retention, confirmation, and audit
  semantics are not defined;
- `Download`, because export and redaction contracts are not defined;
- universal tags, business descriptions, purposes, or output previews, because
  they are not canonical data fields;
- a universal final result, because captured payload is optional and a model
  span is not always the final result;
- user accounts, teams, invitations, RBAC, SSO, billing, or subscriptions;
- hosted public ingestion or arbitrary public evidence;
- alerts, anomaly detection, run comparison, evaluation scoring, or long-term
  analytics;
- Python SDK or framework integrations;
- database migrations or canonical ingestion-contract changes;
- claims of AWS deployment, users, revenue, traction, certification, or program
  acceptance.

These capabilities require separate product decisions and specifications.

## 14. Security and Privacy Constraints

All parent M1 security decisions remain binding:

- every database and blob query is project-scoped on the server;
- evidence is fetched through the backend route;
- browser code never receives object-store credentials, raw storage keys, or
  direct blob URLs;
- sensitive fields remain redacted before storage;
- unavailable or intentionally uncaptured evidence is not reconstructed;
- public demo data remains synthetic;
- errors and technical disclosures never expose secrets;
- no new analytics service records evidence content.

The plain-language layer is a projection of authorized metadata. It does not
weaken project scoping or evidence access boundaries.

## 15. Testing Strategy

### 15.1 Presentation-unit tests

Tests cover:

- deterministic title humanization;
- explicit sample display title;
- outcome and completion labels;
- factual summary templates;
- span-kind to plain-category mapping;
- external-action counts;
- payload-aware action rendering;
- unpriced and unavailable-duration copy;
- no invented final result or purpose.

### 15.2 Component tests

Tests verify:

- orientation and read-only banners;
- primary CTA uniqueness;
- human title plus technical identifier;
- visible labels for search and filters;
- readable step sequence;
- `Metadata only` for spans without payload;
- recorded-data drawer terminology and technical disclosure;
- source controls hidden when the canonical URL is absent;
- source controls consistent when it is configured;
- verified quickstart copy.

### 15.3 End-to-end tests

Desktop and mobile E2E cover:

1. Landing `Explore the guided demo`.
2. `/traces` first-time orientation.
3. `Explore the sample run`.
4. Run summary and `What happened`.
5. Payload-bearing step inspection.
6. Non-payload step with no dead-end link.
7. Drawer close, Escape, focus containment, and focus restoration.
8. Search, filters, filtered-empty, clear filters, and pagination.
9. Loading, error, not-found, incomplete, and unpriced fixtures.
10. No horizontal overflow at 390 px.

### 15.4 Accessibility and visual gates

- keyboard traversal reaches every action in a logical order;
- headings form a valid hierarchy;
- helper text is programmatically associated with controls where applicable;
- status is understandable without color;
- focus is visible;
- 200% zoom remains usable;
- reduced-motion checks remain green;
- WCAG AA automated checks pass;
- desktop and mobile screenshots are reviewed for hierarchy and clipping;
- AgentRail anti-slop audit reports zero blocking findings.

### 15.5 Repository gates

The implementation plan must require fresh successful runs of:

- web unit and component tests;
- integration tests affected by read-model changes;
- complete Playwright desktop and mobile projects;
- anti-slop audit;
- TypeScript typecheck;
- production Next.js build;
- formatting check.

## 16. AWS Activate Alignment

M1.1 strengthens the evidence available for an AWS Activate Founders
application without making acceptance claims:

- the product and target user are understandable;
- the website is a functioning product experience rather than a static
  portfolio;
- the demo demonstrates run, step, cost, evidence, and external-action value;
- the source and local quickstart can be verified;
- the AWS use-of-credits story maps to the already documented target
  architecture: API Gateway/Lambda, SQS, RDS PostgreSQL, private S3, Secrets
  Manager, and CloudWatch;
- the public demo is explicitly synthetic and read-only;
- future AWS work is described as a funded technical milestone, not as an
  already-deployed capability.

Before applying, the operator still needs a real public repository, canonical
domain, matching business email, active paid-tier AWS account, accurate startup
profile, and honest funding-stage information. Product UX cannot guarantee
program eligibility or approval.

## 17. Scope Boundary for the Implementation Plan

M1.1 is one implementation plan with the following ordered workstreams:

1. Presentation copy contracts and deterministic view models.
2. Demo annotations, navigation, and read-only orientation.
3. Agent-run index and all index states.
4. Run summary and readable step sequence.
5. Payload-aware evidence and external-action disclosure.
6. Mobile, accessibility, error, incomplete, and unpriced states.
7. Landing quickstart, source configuration, AWS-centric copy, and README
   credibility repairs.
8. Unit, component, E2E, visual, accessibility, anti-slop, typecheck, format,
   and build verification.

No workstream may introduce database migration, authentication, workflow
execution, mutation API, hosted public ingestion, or a new SaaS subsystem.

## 18. Final Design Acceptance Checklist

- [ ] A first-time visitor can explain AgentRail and the purpose of `/traces`
      without knowing observability terminology.
- [ ] A primary developer can still reach exact Trace Rail timing, span
      identity, actor attribution, usage, cost, attributes, and payload data.
- [ ] The sample is unmistakably synthetic and read-only on desktop and mobile.
- [ ] Every CTA maps to an implemented capability.
- [ ] No payload-absent span opens an empty evidence interaction.
- [ ] Copy never invents causality, purpose, final output, or live state.
- [ ] Unknown price remains nullable and explicit.
- [ ] Existing backend evidence and project-scope boundaries remain unchanged.
- [ ] Landing, dashboard, source, README, and SDK instructions agree.
- [ ] The product story is customer-first and AWS-compatible without being
      grant-centric.
