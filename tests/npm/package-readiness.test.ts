import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
  description?: string;
  license?: string;
  repository?: {
    type?: string;
    url?: string;
    directory?: string;
  };
  bugs?: {
    url?: string;
  };
  homepage?: string;
  publishConfig?: {
    access?: string;
  };
  bin?: Record<string, string>;
  files?: string[];
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const publishablePackages = ["contracts", "db", "sdk", "mcp"] as const;

const expectedPackageVersions = {
  contracts: "0.1.1",
  db: "0.1.0",
  sdk: "0.1.0",
  mcp: "0.1.0",
} as const;

const expectedInternalWorkspaceDependencies = {
  "@agentrail-sdk/sdk": {
    "@agentrail-sdk/contracts": "workspace:0.1.1",
  },
  "@agentrail-sdk/mcp": {
    "@agentrail-sdk/db": "workspace:0.1.0",
  },
} satisfies Record<string, Record<string, string>>;

function readPackageJson(packageName: (typeof publishablePackages)[number]) {
  return JSON.parse(
    readFileSync(join("packages", packageName, "package.json"), "utf8"),
  ) as PackageJson;
}

function dependencyGroups(manifest: PackageJson) {
  return [
    manifest.dependencies ?? {},
    manifest.optionalDependencies ?? {},
    manifest.peerDependencies ?? {},
  ];
}

describe("npm package readiness", () => {
  it("marks publishable packages as public scoped npm packages with metadata", () => {
    for (const packageName of publishablePackages) {
      const manifest = readPackageJson(packageName);

      expect(manifest.name).toMatch(/^@agentrail-sdk\//);
      expect(manifest.version).toBe(expectedPackageVersions[packageName]);
      expect(manifest.private).not.toBe(true);
      expect(manifest.publishConfig?.access).toBe("public");
      expect(manifest.description).toMatch(/AgentRail/i);
      expect(manifest.license).toBe("Apache-2.0");
      expect(manifest.repository).toMatchObject({
        type: "git",
        url: "git+https://github.com/marcelaritonang/agentrail.git",
        directory: `packages/${packageName}`,
      });
      expect(manifest.bugs?.url).toBe(
        "https://github.com/marcelaritonang/agentrail/issues",
      );
      expect(manifest.homepage).toBe(
        "https://github.com/marcelaritonang/agentrail#readme",
      );
      expect(manifest.files).toContain("dist");
      expect(manifest.exports?.["."]).toBeDefined();
    }
  });

  it("uses exact workspace versions that pnpm rewrites for registry tarballs", () => {
    for (const packageName of publishablePackages) {
      const manifest = readPackageJson(packageName);

      for (const dependencies of dependencyGroups(manifest)) {
        for (const [dependencyName, versionRange] of Object.entries(
          dependencies,
        )) {
          if (dependencyName.startsWith("@agentrail-sdk/")) {
            expect(versionRange, `${manifest.name} -> ${dependencyName}`).toBe(
              expectedInternalWorkspaceDependencies[manifest.name]?.[
                dependencyName
              ],
            );
            continue;
          }

          expect(
            versionRange,
            `${manifest.name} -> ${dependencyName}`,
          ).not.toMatch(/^workspace:/);
        }
      }

      expect(manifest.dependencies ?? {}).toMatchObject(
        expectedInternalWorkspaceDependencies[manifest.name] ?? {},
      );
    }
  });

  it("keeps the MCP package executable through npx", () => {
    const manifest = readPackageJson("mcp");

    expect(manifest.bin).toEqual({
      "agentrail-mcp": "./dist/index.js",
    });
  });
});
