import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const landing = readFileSync("apps/web/app/page.tsx", "utf8");
const readme = readFileSync("README.md", "utf8");
const architecture = readFileSync("docs/architecture.md", "utf8");
const aws = readFileSync("docs/deployment/aws.md", "utf8");
const mcp = readFileSync("docs/operations/mcp.md", "utf8");
const pitch = readFileSync("docs/startup/pitch.md", "utf8");
const testers = readFileSync("docs/community/founding-testers.md", "utf8");
const testerInterview = readFileSync(
  "docs/community/founding-tester-interview.md",
  "utf8",
);
const testerIssueTemplate = readFileSync(
  ".github/ISSUE_TEMPLATE/founding-tester.yml",
  "utf8",
);
const testerPage = readFileSync(
  "apps/web/app/founding-testers/page.tsx",
  "utf8",
);
const sdk = [
  readFileSync("packages/sdk/src/agentrail.ts", "utf8"),
  readFileSync("packages/sdk/src/trace-context.ts", "utf8"),
  readFileSync("packages/sdk/src/delivery.ts", "utf8"),
].join("\n");
const envExample = readFileSync(".env.example", "utf8");
const requiredPublicDocuments = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  "docs/architecture.md",
  "docs/deployment/aws.md",
  "docs/operations/api-keys.md",
  "docs/operations/mcp.md",
  "docs/startup/pitch.md",
  "docs/community/founding-testers.md",
  "docs/community/founding-tester-interview.md",
  ".github/ISSUE_TEMPLATE/founding-tester.yml",
];

function expectNoStalePublicCopy(source: string) {
  expect(source).not.toMatch(/dashboard is the next implementation stage/i);
  expect(source).not.toMatch(/new AgentRail\(\{\s*apiKey/i);
  expect(source).not.toMatch(/trace\.llm\(/i);
  expect(source).not.toMatch(/pnpm add @agentrail-sdk\/sdk/i);
  expect(source).not.toMatch(/AWS startup application/i);
}

describe("public AgentRail documentation", () => {
  it("contains every required public document", () => {
    for (const path of requiredPublicDocuments) {
      expect(() => readFileSync(path, "utf8")).not.toThrow();
    }
  });

  it("documents canonical idempotency and 202 semantics", () => {
    expect(architecture).toContain("(project_id, span_id)");
    expect(architecture).toContain("202 Accepted");
    expect(architecture).toContain("queue acknowledgment");
  });

  it("keeps landing and README copy aligned with the implemented SDK", () => {
    for (const source of [landing, readme]) {
      expect(source).toContain("BufferedDelivery");
      expect(source).toContain("HttpSpanTransport");
      expect(source).toContain('await rail.trace({ name: "research.answer" }');
      expect(source).toContain(
        'await trace.action({ name: "filesystem.read" }',
      );
      expectNoStalePublicCopy(source);
    }

    expect(sdk).toContain("class BufferedDelivery");
    expect(sdk).toContain("class HttpSpanTransport");
    expect(sdk).toContain("span<T>(");
    expect(sdk).toContain("action<T>(");
  });

  it("documents the current public product state without grant claims", () => {
    expect(readme).toMatch(/guided sample/i);
    expect(readme).toMatch(/forensic dashboard/i);
    expect(readme).toMatch(/landing page/i);
    expect(readme).toMatch(/read-only synthetic demo/i);
    expect(readme).toMatch(/not a production-readiness or funding claim/i);
    expect(readme).toMatch(/optional/i);
    expect(readme).toMatch(/HTTPS-only/i);
    expect(readme).toMatch(/build-time/i);
    expect(aws).toContain("reference mapping");
    expect(aws).toContain("does not guarantee");
    expectNoStalePublicCopy(readme);
  });

  it("exposes the public demo and source URL environment contract", () => {
    expect(envExample).toContain("AGENTRAIL_DEMO_MODE=0");
    expect(envExample).toContain(
      "NEXT_PUBLIC_AGENTRAIL_SITE_URL=https://agentrail.id",
    );
    expect(envExample).toContain("NEXT_PUBLIC_AGENTRAIL_SOURCE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_AGENTRAIL_CONTACT_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL=");
  });

  it("keeps public trust routes explicit without fake contact details", () => {
    for (const path of [
      "apps/web/app/privacy/page.tsx",
      "apps/web/app/terms/page.tsx",
      "apps/web/app/security/page.tsx",
      "apps/web/app/architecture/page.tsx",
    ]) {
      expect(() => readFileSync(path, "utf8")).not.toThrow();
    }

    expect(readFileSync("apps/web/app/security/page.tsx", "utf8")).not.toMatch(
      /mailto:/i,
    );
    expect(readFileSync("apps/web/app/terms/page.tsx", "utf8")).not.toMatch(
      /governing law|jurisdiction/i,
    );
  });

  it("documents the read-only MCP integration without over-claiming", () => {
    expect(readme).toContain("@agentrail-sdk/mcp");
    expect(readme).toContain("docs/operations/mcp.md");
    expect(mcp).toContain("@agentrail-sdk/mcp");
    expect(mcp).toMatch(/read-only MCP/i);
    expect(mcp).toContain("agentrail_list_traces");
    expect(mcp).toContain("does not automatically record Codex or Claude");
    expect(mcp).not.toMatch(/hosted remote MCP/i);
    expect(mcp).not.toMatch(/AWS acceptance/i);
    expect(mcp).not.toMatch(/funding guarantee/i);
    expect(mcp).not.toMatch(/raw payload access/i);
  });

  it("documents npm install status without directing users to the unrelated unscoped package", () => {
    expect(readme).toContain("npm install agentrail");
    expect(readme).toContain("is not this project");
    expect(readme).toContain("npm install @agentrail-sdk/sdk");
    expect(readme).toContain("npm install -D @agentrail-sdk/cli");
    expect(readme).toContain("npx -y @agentrail-sdk/cli context");
    expect(readme).toContain("npx -y @agentrail-sdk/mcp");
    expect(readme).toMatch(/published on npm/i);
    expect(readme).toContain("@agentrail-sdk/contracts");
    expect(readme).toContain("0.1.1");
    expect(readme).toContain("@agentrail-sdk/db");
    expect(readme).toContain("0.1.0");
    expect(readme).toContain("@agentrail-sdk/sdk");
    expect(readme).toContain("@agentrail-sdk/mcp");
    expect(readme).toContain("@agentrail-sdk/mcp@0.1.2");
    expect(readme).toContain("@agentrail-sdk/context");
    expect(readme).toContain("@agentrail-sdk/cli");
    expect(mcp).toContain("npx -y @agentrail-sdk/mcp");
    expect(mcp).toContain("MCP Context profile 0.1.2");
    expect(mcp).toMatch(/published on npm/i);
    expect(mcp).not.toMatch(/source checkout now/i);
    expect(mcp).not.toMatch(/registry publish/i);
    expect(readme).not.toMatch(/npm authentication/i);
    expect(readme).not.toMatch(/publish-ready/i);
    expect(readme).not.toMatch(/public registry still needs/i);
    expect(readme).not.toMatch(/pnpm pack is the public install path/i);
    expect(readme).not.toMatch(/target after registry publish/i);
    expect(readme).not.toMatch(/still marked `private: true`/i);
    expect(readme).not.toMatch(/unresolved `workspace:\*`/i);
  });

  it("documents startup readiness materials for AWS Activate preparation", () => {
    expect(readme).toContain("Why AgentRail exists");
    expect(readme).toContain("Built for AWS");
    expect(readme).toContain("Founding tester plan");
    expect(readme).toContain("Startup pitch");
    expect(readme).toContain("API Gateway, Lambda, SQS");
    expect(readme).toContain("RDS/PostgreSQL, S3, CloudWatch");
    expect(pitch).toContain("AgentRail is an open-source flight recorder");
    expect(pitch).toContain("AWS credits");
    expect(testers).toContain("three founding testers");
    expect(testers).toContain("AI agent application developer");
    expect(readme).not.toMatch(/funding guarantee/i);
  });

  it("defines a real founding-tester intake without fake traction", () => {
    expect(testers).toContain("installation completed");
    expect(testers).toContain("first Context Pack created");
    expect(testers).toContain("returned within seven days");
    expect(testers).toContain("uninstall reason");
    expect(testers).not.toMatch(/waiting for the milestone/i);
    expect(testers).not.toMatch(/already used by|customers|active users/i);

    expect(testerPage).toContain("NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL");
    expect(testerPage).toContain("intake is being prepared");
    expect(testerPage).toContain("Open tester intake");

    expect(testerIssueTemplate).toContain("Do not paste source code");
    expect(testerIssueTemplate).toContain("prompts");
    expect(testerIssueTemplate).toContain("API keys");
    expect(testerIssueTemplate).toContain("credentials");
    expect(testerIssueTemplate).toContain("client");
    expect(testerIssueTemplate).toContain("operating system");
    expect(testerIssueTemplate).toContain("repository language");
    expect(testerIssueTemplate).toContain("installation outcome");
    expect(testerIssueTemplate).toContain("first Context Pack outcome");
    expect(testerIssueTemplate).toContain("anonymized aggregate use");

    for (const expected of [
      "task category",
      "context miss",
      "useful sources",
      "irrelevant sources",
      "latency perception",
      "privacy concern",
      "uninstall reason",
      "anonymized quote",
    ]) {
      expect(testerInterview).toContain(expected);
    }
  });

  it("keeps the AWS Activate application pack evidence-linked and honest", () => {
    const application = readFileSync(
      "docs/startup/aws-activate-application.md",
      "utf8",
    );
    const creditPlan = readFileSync(
      "docs/startup/aws-90-day-credit-plan.md",
      "utf8",
    );
    const evidence = readFileSync("docs/startup/evidence-register.md", "utf8");
    const checklist = readFileSync(
      "docs/startup/application-readiness-checklist.md",
      "utf8",
    );
    const evidenceHeader =
      /\|\s*Claim\s*\|\s*Evidence\s*\|\s*Status\s*\|\s*Owner\s*\|/;

    expect(application).toContain("Problem");
    expect(application).toContain("Solution");
    expect(application).toContain("Target user");
    expect(application).toContain("Why AWS");
    expect(application).toContain("90-day plan");
    expect(application).toMatch(/does not guarantee acceptance/i);
    expect(application).toMatch(evidenceHeader);
    expect(application).not.toMatch(
      /guaranteed|already funded|thousands of users/i,
    );

    for (const source of [application, evidence]) {
      expect(source).toMatch(evidenceHeader);
      expect(source).toMatch(/\|\s*verified\s*\|/i);
      expect(source).toMatch(/\|\s*pending\s*\|/i);
      expect(source).toMatch(/\|\s*not-applicable\s*\|/i);
    }

    expect(creditPlan).toContain("API Gateway");
    expect(creditPlan).toContain("Lambda");
    expect(creditPlan).toContain("SQS");
    expect(creditPlan).toContain("RDS PostgreSQL");
    expect(creditPlan).toContain("S3 only for opt-in evidence");
    expect(creditPlan).toContain("Secrets Manager");
    expect(creditPlan).toContain("CloudWatch");
    expect(creditPlan).toContain("AWS Budgets");
    expect(creditPlan).not.toMatch(/invoice|guaranteed|unlimited/i);

    expect(checklist).toContain("AWS Paid Tier account");
    expect(checklist).toContain("company website");
    expect(checklist).toContain("npm scope");
    expect(checklist).toContain("GitHub");
    expect(evidence).toContain("MCP Context profile is live on npm.");
    expect(evidence).toMatch(
      /\|\s*MCP Context profile is live on npm\.\s*\|[^|]*@agentrail-sdk\/mcp[^|]*0\.1\.2[^|]*\|\s*verified\s*\|/i,
    );
    expect(application).not.toMatch(
      /MCP Context profile is available from public npm registry\.[\s\S]*\|\s*pending\s*\|/i,
    );
  });
});
