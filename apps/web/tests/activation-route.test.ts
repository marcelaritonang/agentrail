import { describe, expect, it, vi } from "vitest";

import { createActivationApprovalHandler } from "../lib/activation";

const PROJECT_A = "00000000-0000-4000-8000-000000000201";
const USER_A = "user_a";
const NOW = new Date("2026-07-30T08:00:00.000Z");

function approvalRequest(body: unknown): Request {
  return new Request("https://agentrail.id/api/activation/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authenticatedProject() {
  return {
    status: "authenticated" as const,
    user: { userId: USER_A, role: "member" as const },
    project: {
      projectId: PROJECT_A,
      ownerUserId: USER_A,
      name: "AgentRail hosted",
      privacyMode: "metrics-only" as const,
    },
  };
}

describe("activation approval route", () => {
  it("requires an authenticated session before approving a device", async () => {
    const approveDeviceCode = vi.fn();
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer: async () => ({ status: "unauthenticated" }),
      repository: { approveDeviceCode },
    });

    const response = await handler(
      approvalRequest({ code: "ABCD-EFGH-JKLM", projectId: PROJECT_A }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "login_required",
    });
    expect(approveDeviceCode).not.toHaveBeenCalled();
  });

  it("requires the selected project to belong to the session user", async () => {
    const approveDeviceCode = vi.fn();
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer: async () => ({ status: "forbidden" }),
      repository: { approveDeviceCode },
    });

    const response = await handler(
      approvalRequest({ code: "ABCD-EFGH-JKLM", projectId: PROJECT_A }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ status: "invalid" });
    expect(approveDeviceCode).not.toHaveBeenCalled();
  });

  it("approves a valid user code by digest without echoing metadata", async () => {
    const approveDeviceCode = vi.fn(async () => "approved" as const);
    const resolveViewer = vi.fn(async () => authenticatedProject());
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer,
      repository: { approveDeviceCode },
    });

    const response = await handler(
      approvalRequest({ code: "ABCD-EFGH-JKLM", projectId: PROJECT_A }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "approved" });
    expect(resolveViewer).toHaveBeenCalledWith(PROJECT_A);
    expect(approveDeviceCode).toHaveBeenCalledWith({
      userCodeDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      userId: USER_A,
      projectId: PROJECT_A,
      now: NOW,
    });
    expect(JSON.stringify(approveDeviceCode.mock.calls)).not.toContain(
      "ABCD-EFGH-JKLM",
    );
    expect(JSON.stringify(body)).not.toContain(PROJECT_A);
    expect(JSON.stringify(body)).not.toContain(USER_A);
  });

  it("returns safe invalid state for malformed or unknown codes", async () => {
    const approveDeviceCode = vi.fn(async () => "not_found" as const);
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer: async () => authenticatedProject(),
      repository: { approveDeviceCode },
    });

    const malformed = await handler(approvalRequest({ code: "not valid" }));
    const unknown = await handler(approvalRequest({ code: "WXYZ-2345-6789" }));
    const malformedText = await malformed.text();
    const unknownText = await unknown.text();

    expect(malformed.status).toBe(400);
    expect(malformedText).not.toContain(PROJECT_A);
    expect(malformedText).not.toContain(USER_A);
    expect(unknown.status).toBe(404);
    expect(JSON.parse(unknownText)).toEqual({ status: "invalid" });
    expect(unknownText).not.toContain(PROJECT_A);
    expect(unknownText).not.toContain(USER_A);
  });

  it("maps expired and already-approved user codes to explicit states", async () => {
    const approveDeviceCode = vi
      .fn()
      .mockResolvedValueOnce("expired")
      .mockResolvedValueOnce("already_approved");
    const handler = createActivationApprovalHandler({
      now: () => NOW,
      resolveViewer: async () => authenticatedProject(),
      repository: { approveDeviceCode },
    });

    const expired = await handler(
      approvalRequest({ code: "ABCD-EFGH-JKLM", projectId: PROJECT_A }),
    );
    const already = await handler(
      approvalRequest({ code: "ABCD-EFGH-JKLM", projectId: PROJECT_A }),
    );

    expect(expired.status).toBe(400);
    await expect(expired.json()).resolves.toEqual({ status: "expired" });
    expect(already.status).toBe(409);
    await expect(already.json()).resolves.toEqual({
      status: "already_approved",
    });
  });
});
