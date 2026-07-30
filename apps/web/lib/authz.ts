export type AuthenticatedViewer = {
  userId: string;
  role: "member" | "admin";
  projectId: string;
};

export type AuthzProject = {
  projectId: string;
  ownerUserId: string;
  name: string;
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
};

export type AuthzProjectRepository = {
  getOrCreateDefaultProject(userId: string): Promise<AuthzProject>;
  findOwnedProject(input: {
    userId: string;
    projectId: string;
  }): Promise<AuthzProject | null>;
};

export type AuthzResult =
  | { status: "authenticated"; viewer: AuthenticatedViewer }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export type AuthzSession = {
  user?: {
    id?: unknown;
    role?: unknown;
  };
} | null;

export function createAuthzResolver(input: {
  demoModeEnabled: () => boolean;
  readSession: () => Promise<AuthzSession>;
  repository: AuthzProjectRepository;
}) {
  return {
    async resolveViewer(options: { projectId?: string } = {}) {
      const session = await input.readSession();
      const userId = session?.user?.id;

      if (typeof userId !== "string" || userId.trim() === "") {
        return { status: "unauthenticated" } satisfies AuthzResult;
      }

      const role = session?.user?.role === "admin" ? "admin" : "member";
      const project =
        options.projectId === undefined
          ? await input.repository.getOrCreateDefaultProject(userId)
          : await input.repository.findOwnedProject({
              userId,
              projectId: options.projectId,
            });

      if (project === null) {
        return { status: "forbidden" } satisfies AuthzResult;
      }

      return {
        status: "authenticated",
        viewer: {
          userId,
          role,
          projectId: project.projectId,
        },
      } satisfies AuthzResult;
    },

    async resolveAdmin(options: { projectId?: string } = {}) {
      const result = await this.resolveViewer(options);
      if (result.status !== "authenticated") {
        return result;
      }
      if (result.viewer.role !== "admin") {
        return { status: "forbidden" } satisfies AuthzResult;
      }
      return result;
    },
  };
}

export async function requireViewer(
  options: { projectId?: string } = {},
): Promise<AuthenticatedViewer> {
  const result = await productionAuthz().resolveViewer(options);
  return resolveRequiredViewer(result);
}

export async function requireAdmin(
  options: { projectId?: string } = {},
): Promise<AuthenticatedViewer> {
  const result = await productionAuthz().resolveAdmin(options);
  return resolveRequiredViewer(result);
}

function productionAuthz() {
  return createAuthzResolver({
    demoModeEnabled: () => {
      return false;
    },
    readSession: async () => {
      const [{ headers }, { getAuth }] = await Promise.all([
        import("next/headers"),
        import("../auth"),
      ]);

      return getAuth().api.getSession({
        headers: await headers(),
      }) as Promise<AuthzSession>;
    },
    repository: productionProjectRepository(),
  });
}

function productionProjectRepository(): AuthzProjectRepository {
  return {
    async getOrCreateDefaultProject(userId) {
      const { projectAccessRepository } = await import("./control-database");
      return projectAccessRepository.getOrCreateDefaultProject(userId);
    },
    async findOwnedProject(input) {
      const { projectAccessRepository } = await import("./control-database");
      return projectAccessRepository.findOwnedProject(input);
    },
  };
}

async function resolveRequiredViewer(
  result: AuthzResult,
): Promise<AuthenticatedViewer> {
  if (result.status === "authenticated") {
    return result.viewer;
  }
  if (result.status === "unauthenticated") {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  const { notFound } = await import("next/navigation");
  notFound();
  throw new Error("Unreachable authorization state.");
}
