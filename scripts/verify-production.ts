import { pathToFileURL } from "node:url";

export type ProductionCheck = {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  detail: string;
};

type FetchResult = {
  url: string;
  status: number | null;
  body: string;
  detail: string;
};

type FetchTextOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

const PUBLIC_PATHS = [
  "/",
  "/traces",
  "/about",
  "/architecture",
  "/privacy",
  "/terms",
  "/security",
  "/founding-testers",
  "/robots.txt",
  "/sitemap.xml",
] as const;

const HTML_PATHS = [
  "/",
  "/traces",
  "/about",
  "/architecture",
  "/privacy",
  "/terms",
  "/security",
  "/founding-testers",
] as const;

function normalizeOrigin(origin: URL): URL {
  return new URL(origin.origin);
}

function publicUrl(origin: URL, path: string): URL {
  return new URL(path, normalizeOrigin(origin));
}

async function fetchText(
  url: URL,
  options: FetchTextOptions = {},
  redirectCount = 0,
): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        "user-agent": "AgentRail production verifier",
        ...options.headers,
      },
      body: options.body,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      if (redirectCount >= MAX_REDIRECTS) {
        return {
          url: url.href,
          status: response.status,
          body: "",
          detail: "redirect limit exceeded",
        };
      }

      return fetchText(
        new URL(response.headers.get("location") ?? "", url),
        options,
        redirectCount + 1,
      );
    }

    return {
      url: response.url,
      status: response.status,
      body: await response.text(),
      detail: response.ok ? "ok" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url: url.href,
      status: null,
      body: "",
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}

function htmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}=(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function canonicalHref(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = htmlAttribute(tag, "rel");
    if (rel?.toLowerCase().split(/\s+/).includes("canonical")) {
      return htmlAttribute(tag, "href");
    }
  }

  return null;
}

function normalizedCanonical(value: string, origin: URL): string | null {
  try {
    const url = new URL(value, origin);
    url.hash = "";

    if (url.pathname === "/" && url.search === "") {
      return url.origin;
    }

    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function hasEmptyHref(html: string): boolean {
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = htmlAttribute(match[0], "href");
    if (href !== null && href.trim().length === 0) {
      return true;
    }
  }

  return false;
}

function check(
  name: string,
  url: URL,
  ok: boolean,
  status: number | null,
  detail: string,
): ProductionCheck {
  return {
    name,
    url: url.href,
    ok,
    status,
    detail,
  };
}

function jsonFromBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function statusField(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof value.status === "string"
  ) {
    return value.status;
  }

  return null;
}

function errorCodeField(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error &&
    typeof value.error.code === "string"
  ) {
    return value.error.code;
  }

  return null;
}

function isConfigurationUnavailable(response: FetchResult): boolean {
  const body = jsonFromBody(response.body);
  return (
    response.status === 503 &&
    (statusField(body) === "service_unavailable" ||
      errorCodeField(body) === "service_unavailable")
  );
}

function statusIn(response: FetchResult, allowed: readonly number[]): boolean {
  return response.status !== null && allowed.includes(response.status);
}

async function postJson(url: URL, body: unknown): Promise<FetchResult> {
  return fetchText(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function verifyProduction(
  origin: URL,
): Promise<readonly ProductionCheck[]> {
  const normalized = normalizeOrigin(origin);
  const responses = new Map<string, FetchResult>();
  const checks: ProductionCheck[] = [];

  for (const path of PUBLIC_PATHS) {
    const url = publicUrl(normalized, path);
    const response = await fetchText(url);
    responses.set(path, response);
    checks.push(
      check(
        `route:${path}`,
        url,
        response.status !== null &&
          response.status >= 200 &&
          response.status < 300,
        response.status,
        response.detail,
      ),
    );
  }

  const root = responses.get("/");
  const href = root === undefined ? null : canonicalHref(root.body);
  checks.push(
    check(
      "canonical:/",
      publicUrl(normalized, "/"),
      href !== null &&
        normalizedCanonical(href, normalized) === normalized.origin,
      root?.status ?? null,
      href === null ? "missing canonical link" : `canonical ${href}`,
    ),
  );

  const emptyHrefPath = HTML_PATHS.find((path) => {
    const response = responses.get(path);
    return response !== undefined && hasEmptyHref(response.body);
  });
  checks.push(
    check(
      "cta-empty-href",
      publicUrl(normalized, emptyHrefPath ?? "/"),
      emptyHrefPath === undefined,
      responses.get(emptyHrefPath ?? "/")?.status ?? null,
      emptyHrefPath === undefined
        ? "no empty href anchors found"
        : `empty href anchor found on ${emptyHrefPath}`,
    ),
  );

  const traces = responses.get("/traces");
  const traceBody = traces?.body ?? "";
  checks.push(
    check(
      "synthetic-demo-label:/traces",
      publicUrl(normalized, "/traces"),
      /read-only example/i.test(traceBody) && /synthetic/i.test(traceBody),
      traces?.status ?? null,
      "requires read-only example and synthetic demo labeling",
    ),
  );

  const deviceCodeUrl = publicUrl(normalized, "/v1/device/code");
  const deviceCode = await postJson(deviceCodeUrl, {
    schema_version: 1,
    client_type: "codex",
    package_version: "production-smoke",
  });
  checks.push(
    check(
      "hosted-device-code:/v1/device/code",
      deviceCodeUrl,
      statusIn(deviceCode, [200, 429]) &&
        !isConfigurationUnavailable(deviceCode),
      deviceCode.status,
      isConfigurationUnavailable(deviceCode)
        ? "hosted device-code endpoint is not configured"
        : deviceCode.detail,
    ),
  );

  const deviceTokenUrl = publicUrl(normalized, "/v1/device/token");
  const deviceToken = await postJson(deviceTokenUrl, {
    schema_version: 1,
    device_code: "production-smoke-invalid-device-code",
  });
  checks.push(
    check(
      "hosted-device-token:/v1/device/token",
      deviceTokenUrl,
      statusIn(deviceToken, [200, 202, 400, 403, 429]) &&
        !isConfigurationUnavailable(deviceToken),
      deviceToken.status,
      isConfigurationUnavailable(deviceToken)
        ? "hosted device-token endpoint is not configured"
        : deviceToken.detail,
    ),
  );

  const eventsUrl = publicUrl(normalized, "/v1/events");
  const events = await postJson(eventsUrl, {
    events: [],
  });
  checks.push(
    check(
      "hosted-events-auth:/v1/events",
      eventsUrl,
      events.status === 401 && !isConfigurationUnavailable(events),
      events.status,
      isConfigurationUnavailable(events)
        ? "hosted usage-events endpoint is not configured"
        : events.detail,
    ),
  );

  return checks;
}

export function productionOriginFromArgs(
  args: readonly string[],
  environmentUrl: string | undefined,
): URL {
  const urlIndex = args.indexOf("--url");
  const explicitUrl =
    urlIndex >= 0 && args[urlIndex + 1] !== undefined
      ? args[urlIndex + 1]
      : undefined;

  return new URL(explicitUrl ?? environmentUrl ?? "https://agentrail.id");
}

async function main() {
  const origin = productionOriginFromArgs(
    process.argv.slice(2),
    process.env.AGENTRAIL_WEB_URL,
  );
  const checks = await verifyProduction(origin);

  for (const item of checks) {
    const marker = item.ok ? "PASS" : "FAIL";
    console.log(
      `${marker} ${item.name} ${item.status ?? "-"} ${item.url} ${item.detail}`,
    );
  }

  if (checks.some((item) => !item.ok)) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
