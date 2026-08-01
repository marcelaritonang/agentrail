import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  productionOriginFromArgs,
  verifyProduction,
} from "../../scripts/verify-production";

type RouteMap = Record<
  string,
  { status?: number; body: string; type?: string }
>;

const servers: Array<ReturnType<typeof createServer>> = [];

function send(res: ServerResponse, status: number, body: string, type: string) {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

async function withServer<T>(
  routes: RouteMap,
  run: (origin: URL) => Promise<T>,
): Promise<T> {
  let originString = "";
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const route = routes[path];

    if (!route) {
      send(res, 404, "not found", "text/plain");
      return;
    }

    send(
      res,
      route.status ?? 200,
      route.body.replaceAll("{{ORIGIN}}", originString),
      route.type ?? "text/html",
    );
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  originString = `http://127.0.0.1:${address.port}`;
  return run(new URL(originString));
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

const goodRoutes: RouteMap = {
  "/": {
    body: '<html><head><link rel="canonical" href="{{ORIGIN}}"></head><body><a href="/traces">Explore</a></body></html>',
  },
  "/traces": {
    body: "<html><body><p>Read-only example using synthetic data.</p></body></html>",
  },
  "/about": { body: "<html><body>About AgentRail</body></html>" },
  "/architecture": { body: "<html><body>Architecture</body></html>" },
  "/privacy": { body: "<html><body>Privacy</body></html>" },
  "/terms": { body: "<html><body>Terms</body></html>" },
  "/security": { body: "<html><body>Security</body></html>" },
  "/founding-testers": {
    body: "<html><body>AgentRail Founding Testers</body></html>",
  },
  "/robots.txt": {
    type: "text/plain",
    body: "User-Agent: *\nAllow: /\nSitemap: {{ORIGIN}}/sitemap.xml",
  },
  "/sitemap.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>{{ORIGIN}}/</loc></url></urlset>",
  },
  "/v1/device/code": {
    type: "application/json",
    body: JSON.stringify({
      device_code: "device-code",
      user_code: "ABCD-EFGH-JKLM",
      verification_uri: "{{ORIGIN}}/activate",
      verification_uri_complete: "{{ORIGIN}}/activate?code=ABCD-EFGH-JKLM",
      expires_in: 600,
      interval: 5,
      request_id: "req_test",
    }),
  },
  "/v1/device/token": {
    status: 400,
    type: "application/json",
    body: JSON.stringify({
      status: "expired_token",
      request_id: "req_test",
    }),
  },
  "/v1/events": {
    status: 401,
    type: "application/json",
    body: JSON.stringify({
      error: {
        code: "unauthorized",
        request_id: "req_test",
        retryable: false,
      },
    }),
  },
};

describe("production readiness verifier", () => {
  it("uses --url before the environment default", () => {
    expect(
      productionOriginFromArgs(
        ["--url", "https://preview.agentrail.id/path"],
        "https://agentrail.id",
      ).href,
    ).toBe("https://preview.agentrail.id/path");
  });

  it("accepts a site that satisfies the public M0 contract", async () => {
    await withServer(goodRoutes, async (origin) => {
      const checks = await verifyProduction(origin);

      expect(checks.every((check) => check.ok)).toBe(true);
      expect(checks.map((check) => check.name)).toEqual([
        "route:/",
        "route:/traces",
        "route:/about",
        "route:/architecture",
        "route:/privacy",
        "route:/terms",
        "route:/security",
        "route:/founding-testers",
        "route:/robots.txt",
        "route:/sitemap.xml",
        "canonical:/",
        "cta-empty-href",
        "synthetic-demo-label:/traces",
        "hosted-device-code:/v1/device/code",
        "hosted-device-token:/v1/device/token",
        "hosted-events-auth:/v1/events",
      ]);
    });
  });

  it("reports canonical, CTA, and demo-label regressions", async () => {
    await withServer(
      {
        ...goodRoutes,
        "/": {
          body: '<html><head><link rel="canonical" href="https://wrong.example"></head><body><a href="">Broken CTA</a></body></html>',
        },
        "/traces": {
          body: "<html><body>Agent run archive.</body></html>",
        },
      },
      async (origin) => {
        const checks = await verifyProduction(origin);
        const failures = checks
          .filter((check) => !check.ok)
          .map((check) => check.name);

        expect(failures).toEqual([
          "canonical:/",
          "cta-empty-href",
          "synthetic-demo-label:/traces",
        ]);
      },
    );
  });

  it("reports hosted control-plane configuration failures", async () => {
    await withServer(
      {
        ...goodRoutes,
        "/v1/device/code": {
          status: 503,
          type: "application/json",
          body: JSON.stringify({
            status: "service_unavailable",
            request_id: "req_test",
          }),
        },
        "/v1/device/token": {
          status: 503,
          type: "application/json",
          body: JSON.stringify({
            status: "service_unavailable",
            request_id: "req_test",
          }),
        },
        "/v1/events": {
          status: 503,
          type: "application/json",
          body: JSON.stringify({
            error: {
              code: "service_unavailable",
              request_id: "req_test",
              retryable: true,
            },
          }),
        },
      },
      async (origin) => {
        const checks = await verifyProduction(origin);
        const failures = checks
          .filter((check) => !check.ok)
          .map((check) => check.name);

        expect(failures).toEqual([
          "hosted-device-code:/v1/device/code",
          "hosted-device-token:/v1/device/token",
          "hosted-events-auth:/v1/events",
        ]);
      },
    );
  });
});
