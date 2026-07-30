import { describe, expect, it, vi } from "vitest";

import {
  createInstallationRevokeHandler,
  createInstallationRotateHandler,
  type InstallationMutationViewerResult,
} from "../lib/installation-routes";

const USER_A = "user_a";
const PROJECT_A = "00000000-0000-4000-8000-000000000801";
const NOW = new Date("2026-07-30T12:00:00.000Z");

function request(path: string, body: unknown): Request {
  return new Request(`https://agentrail.id${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function viewer(): InstallationMutationViewerResult {
  return {
    status: "authenticated",
    user: { userId: USER_A, role: "member" },
    project: { projectId: PROJECT_A },
  };
}

describe("installation mutation routes", () => {
  it("requires a session before revoking an installation", async () => {
    const revokeInstallation = vi.fn();
    const handler = createInstallationRevokeHandler({
      resolveViewer: async () => ({ status: "unauthenticated" }),
      repository: { revokeInstallation },
    });

    const response = await handler(
      request("/api/installations/revoke", {
        installationId: "inst_a",
        confirm: "revoke",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "login_required",
    });
    expect(revokeInstallation).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation payload before revoking", async () => {
    const revokeInstallation = vi.fn();
    const handler = createInstallationRevokeHandler({
      resolveViewer: async () => viewer(),
      repository: { revokeInstallation },
    });

    const response = await handler(
      request("/api/installations/revoke", { installationId: "inst_a" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "confirmation_required",
    });
    expect(revokeInstallation).not.toHaveBeenCalled();
  });

  it("does not reveal another user's installation on revoke", async () => {
    const revokeInstallation = vi.fn(async () => false);
    const handler = createInstallationRevokeHandler({
      resolveViewer: async () => viewer(),
      repository: { revokeInstallation },
    });

    const response = await handler(
      request("/api/installations/revoke", {
        installationId: "inst_other",
        confirm: "revoke",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ status: "not_found" });
    expect(revokeInstallation).toHaveBeenCalledWith({
      installationId: "inst_other",
      ownerUserId: USER_A,
    });
  });

  it("rotates with a protected one-time credential response", async () => {
    const rotateInstallation = vi.fn(async () => ({
      installationId: "inst_new",
      credential: "ar_inst_secret",
    }));
    const handler = createInstallationRotateHandler({
      now: () => NOW,
      createCredential: () => ({
        installationId: "inst_new",
        raw: "ar_inst_secret",
        prefix: "ar_inst_secret".slice(0, 20),
        digest: "digest_new",
      }),
      resolveViewer: async () => viewer(),
      repository: { rotateInstallation },
    });

    const response = await handler(
      request("/api/installations/rotate", {
        installationId: "inst_old",
        confirm: "rotate",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "rotated",
      installationId: "inst_new",
      credential: "ar_inst_secret",
    });
    expect(JSON.stringify(body)).not.toContain("digest_new");
    expect(rotateInstallation).toHaveBeenCalledWith({
      installationId: "inst_old",
      ownerUserId: USER_A,
      credential: {
        installationId: "inst_new",
        raw: "ar_inst_secret",
        prefix: "ar_inst_secret".slice(0, 20),
        digest: "digest_new",
      },
      now: NOW,
    });
  });

  it("requires confirmation before rotating", async () => {
    const rotateInstallation = vi.fn();
    const handler = createInstallationRotateHandler({
      resolveViewer: async () => viewer(),
      repository: { rotateInstallation },
    });

    const response = await handler(
      request("/api/installations/rotate", { installationId: "inst_old" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "confirmation_required",
    });
    expect(rotateInstallation).not.toHaveBeenCalled();
  });
});
