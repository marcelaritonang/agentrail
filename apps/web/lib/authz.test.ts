import { describe, expect, it } from "vitest";

import { createAuthzResolver, type AuthzProjectRepository } from "./authz";

const USER_ID = "user_1";
const DEFAULT_PROJECT_ID = "00000000-0000-4000-8000-000000000701";
const OTHER_PROJECT_ID = "00000000-0000-4000-8000-000000000702";

function repository(
  overrides: Partial<AuthzProjectRepository> = {},
): AuthzProjectRepository {
  return {
    async getOrCreateDefaultProject(userId) {
      return {
        projectId: DEFAULT_PROJECT_ID,
        ownerUserId: userId,
        name: "Default project",
        privacyMode: "metrics-only",
      };
    },
    async findOwnedProject(_input) {
      return null;
    },
    ...overrides,
  };
}

describe("authz resolver", () => {
  it("returns unauthenticated when no session exists", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => null,
      repository: repository(),
    });

    await expect(authz.resolveViewer()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("does not fabricate an authenticated viewer in public demo mode", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => true,
      readSession: async () => null,
      repository: repository(),
    });

    await expect(authz.resolveViewer()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("creates a default owned project when the user has no selected project", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => ({ user: { id: USER_ID, role: "member" } }),
      repository: repository(),
    });

    await expect(authz.resolveViewer()).resolves.toEqual({
      status: "authenticated",
      viewer: {
        userId: USER_ID,
        role: "member",
        projectId: DEFAULT_PROJECT_ID,
      },
    });
  });

  it("rejects a selected project owned by another user", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => ({ user: { id: USER_ID, role: "member" } }),
      repository: repository({
        async findOwnedProject() {
          return null;
        },
      }),
    });

    await expect(
      authz.resolveViewer({ projectId: OTHER_PROJECT_ID }),
    ).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("accepts a selected project owned by the current user", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => ({ user: { id: USER_ID, role: "member" } }),
      repository: repository({
        async findOwnedProject(input) {
          return {
            projectId: input.projectId,
            ownerUserId: input.userId,
            name: "Selected project",
            privacyMode: "metrics-only",
          };
        },
      }),
    });

    await expect(
      authz.resolveViewer({ projectId: DEFAULT_PROJECT_ID }),
    ).resolves.toEqual({
      status: "authenticated",
      viewer: {
        userId: USER_ID,
        role: "member",
        projectId: DEFAULT_PROJECT_ID,
      },
    });
  });

  it("rejects a member from the admin guard", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => ({ user: { id: USER_ID, role: "member" } }),
      repository: repository(),
    });

    await expect(authz.resolveAdmin()).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("allows an admin through the admin guard", async () => {
    const authz = createAuthzResolver({
      demoModeEnabled: () => false,
      readSession: async () => ({ user: { id: USER_ID, role: "admin" } }),
      repository: repository(),
    });

    await expect(authz.resolveAdmin()).resolves.toEqual({
      status: "authenticated",
      viewer: {
        userId: USER_ID,
        role: "admin",
        projectId: DEFAULT_PROJECT_ID,
      },
    });
  });
});
