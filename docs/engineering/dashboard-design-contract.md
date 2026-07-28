# AgentRail Dashboard Design Contract

The AgentRail dashboard is a forensic recorder, not a marketing surface. It uses a graphite canvas, warm-white text, amber for consequential actions, cyan for LLM spans, violet for retrieval, and red for failure. Instrument Sans carries interface language; JetBrains Mono carries identifiers, timestamps, duration, tokens, and cost.

## Structural rules

- Keep information dense, flat, and separated by one-pixel rules.
- Use the small-radius tokens only. Shadows are absent except for the overlaying Evidence Drawer.
- Trace Rail geometry must communicate timing without relying on color. Every row retains its textual name, kind, actor, and duration.
- Mobile layouts are composed deliberately. Desktop tables are replaced by compact mobile lists below 1024 px.
- Unknown pricing is `UNPRICED`; it is never rendered as zero.
- A null completion state has no badge. Only the configured timeout produces `INCOMPLETE`; there is no `running` state.

## Interaction and accessibility

- All interactive elements have inherited `:focus-visible` treatment.
- The Evidence Drawer is a modal dialog with initial focus, Tab containment, Escape close, and origin focus restoration.
- Color is redundant with text. Decorative looping animation is prohibited, and reduced-motion preferences are honored globally.
- Payload evidence is fetched only from the project-scoped Next.js route with private, no-store caching. The browser never receives an object-store reference or credential.

## Automated gate

`pnpm --filter @agentrail-sdk/web anti-slop` blocks raw component colors, gradient/glass effects, a second icon family, `transition-all`, low-contrast amber-on-amber declarations, and the forbidden running status. Large radii, decorative animation, and hover scaling are advisory so a reviewer can judge context.

These checks are a project-specific implementation of the approved AgentRail constraints and universal anti-template audit concepts. No Soleur ZIP code, paths, hooks, connector behavior, or brand rules were copied or installed. The landing-only `design-taste-frontend` skill does not govern dashboard composition.
