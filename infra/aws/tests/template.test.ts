import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

type SamTemplate = {
  Globals?: {
    Function?: {
      Environment?: {
        Variables?: Record<string, unknown>;
      };
    };
  };
  Resources?: Record<string, CloudFormationResource>;
};

type CloudFormationResource = {
  Type?: string;
  Properties?: Record<string, unknown>;
};

const here = dirname(fileURLToPath(import.meta.url));
const infraRoot = join(here, "..");
const templatePath = join(infraRoot, "template.yaml");
const docsPath = join(
  infraRoot,
  "..",
  "..",
  "docs",
  "deployment",
  "aws-control-plane.md",
);

function loadTemplate(): {
  globals: SamTemplate["Globals"];
  text: string;
  resources: Record<string, CloudFormationResource>;
} {
  expect(
    existsSync(templatePath),
    "infra/aws/template.yaml should define the deployable hosted control plane",
  ).toBe(true);

  const text = readFileSync(templatePath, "utf8");
  const document = parseDocument<SamTemplate>(text);

  expect(
    document.errors.map((error) => error.message),
    "SAM template should parse as YAML",
  ).toEqual([]);

  const template = document.toJSON();

  return {
    globals: template?.Globals,
    text,
    resources: template?.Resources ?? {},
  };
}

function resourcesByType(
  resources: Record<string, CloudFormationResource>,
  type: string,
): Array<[string, CloudFormationResource]> {
  return Object.entries(resources).filter(
    ([, resource]) => resource.Type === type,
  );
}

function objectEntries(
  value: unknown,
): Array<[string, Record<string, unknown>]> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, Record<string, unknown>>);
}

function allActions(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allActions);
  if (value === null || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  return [
    ...allActions(record.Action),
    ...Object.values(record).flatMap((nested) => allActions(nested)),
  ];
}

describe("AWS SAM hosted control plane contract", () => {
  it("defines API routes and separate durable queues for spans and usage events", () => {
    const { resources } = loadTemplate();
    const functions = resourcesByType(resources, "AWS::Serverless::Function");
    const routes = functions.flatMap(([, resource]) =>
      objectEntries(resource.Properties?.Events).flatMap(([, event]) => {
        const properties = event.Properties as
          Record<string, unknown> | undefined;
        return typeof properties?.Path === "string" ? [properties.Path] : [];
      }),
    );

    expect(routes).toEqual(
      expect.arrayContaining([
        "/v1/device/code",
        "/v1/device/token",
        "/v1/events",
        "/v1/spans",
      ]),
    );

    const queues = resourcesByType(resources, "AWS::SQS::Queue");
    const queueNames = queues.map(([name]) => name.toLowerCase());
    expect(queueNames.some((name) => name.includes("span"))).toBe(true);
    expect(queueNames.some((name) => name.includes("usage"))).toBe(true);
    expect(
      queueNames.filter((name) => name.includes("dlq")).length,
    ).toBeGreaterThanOrEqual(2);

    const primaryQueues = queues.filter(
      ([name]) => !name.toLowerCase().includes("dlq"),
    );
    expect(primaryQueues.length).toBeGreaterThanOrEqual(2);
    for (const [name, resource] of primaryQueues) {
      expect(
        resource.Properties?.RedrivePolicy,
        `${name} should have a DLQ`,
      ).toBeDefined();
    }
  });

  it("sets Lambda concurrency, finite logs, and CloudWatch alarms for operational failure modes", () => {
    const { resources } = loadTemplate();
    const functions = resourcesByType(resources, "AWS::Serverless::Function");
    expect(functions.length).toBeGreaterThanOrEqual(3);

    for (const [name, resource] of functions) {
      expect(
        resource.Properties?.ReservedConcurrentExecutions,
        `${name} must define reserved concurrency`,
      ).toEqual(expect.any(Number));
    }

    const logGroups = resourcesByType(resources, "AWS::Logs::LogGroup");
    expect(logGroups.length).toBeGreaterThanOrEqual(functions.length);
    for (const [name, resource] of logGroups) {
      expect(
        resource.Properties?.RetentionInDays,
        `${name} should have finite retention`,
      ).toEqual(expect.any(Number));
    }

    const alarmNames = resourcesByType(resources, "AWS::CloudWatch::Alarm").map(
      ([name]) => name.toLowerCase(),
    );
    for (const expected of [
      "api5xx",
      "apilatency",
      "queueage",
      "queuedepth",
      "dlq",
      "worker",
    ]) {
      expect(
        alarmNames.some((name) => name.includes(expected)),
        expected,
      ).toBe(true);
    }
  });

  it("keeps RDS and S3 private and encrypted", () => {
    const { resources } = loadTemplate();
    const databases = resourcesByType(resources, "AWS::RDS::DBInstance");
    expect(databases.length).toBe(1);
    const [, database] = databases[0]!;
    expect(database.Properties?.Engine).toBe("postgres");
    expect(database.Properties?.StorageEncrypted).toBe(true);
    expect(database.Properties?.PubliclyAccessible).toBe(false);
    expect(database.Properties?.DBSubnetGroupName).toBeDefined();

    const buckets = resourcesByType(resources, "AWS::S3::Bucket");
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    for (const [name, bucket] of buckets) {
      expect(
        bucket.Properties?.BucketEncryption,
        `${name} should be encrypted`,
      ).toBeDefined();
      expect(
        bucket.Properties?.PublicAccessBlockConfiguration,
        `${name} blocks public access`,
      ).toMatchObject({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
    }
  });

  it("uses references for secrets and scoped IAM instead of broad data-plane wildcards", () => {
    const { globals, resources, text } = loadTemplate();
    expect(text).not.toMatch(
      /agentrail-local-secret|postgresql:\/\/|ghp_|npm_/i,
    );

    const globalVariables = globals?.Function?.Environment?.Variables ?? {};
    const functions = resourcesByType(resources, "AWS::Serverless::Function");
    for (const [name, resource] of functions) {
      const environment = resource.Properties?.Environment as
        { Variables?: Record<string, unknown> } | undefined;
      const variables = {
        ...globalVariables,
        ...(environment?.Variables ?? {}),
      };
      const secretVariables = Object.entries(variables).filter(([key]) =>
        /SECRET|PASSWORD|PEPPER|DATABASE_URL/.test(key),
      );
      expect(
        secretVariables.length,
        `${name} should receive secret-backed env vars`,
      ).toBeGreaterThan(0);
      for (const [key, value] of secretVariables) {
        expect(
          JSON.stringify(value),
          `${name}.${key} should be a reference`,
        ).toMatch(/Secret|Arn|resolve:secretsmanager|Ref|Sub/i);
      }

      for (const action of allActions(resource.Properties?.Policies)) {
        expect(action).not.toMatch(/^(s3|sqs|secretsmanager|rds|kms):\*$/i);
      }
    }
  });

  it("includes budget guardrails or documents the deployment prerequisite", () => {
    const { resources } = loadTemplate();
    const hasBudget =
      resourcesByType(resources, "AWS::Budgets::Budget").length > 0;
    const hasDocumentedPrerequisite =
      existsSync(docsPath) &&
      /budget/i.test(readFileSync(docsPath, "utf8")) &&
      /prerequisite|sebelum deploy|before deploy/i.test(
        readFileSync(docsPath, "utf8"),
      );

    expect(hasBudget || hasDocumentedPrerequisite).toBe(true);
  });
});
