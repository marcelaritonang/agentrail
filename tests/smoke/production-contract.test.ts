import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { verifyProduction } from "../../scripts/verify-production";

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
};

describe("production readiness verifier", () => {
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
});
