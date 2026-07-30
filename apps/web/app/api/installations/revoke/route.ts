import {
  createInstallationMutationRepository,
  createInstallationRevokeHandler,
} from "../../../../lib/installation-routes";

export async function POST(request: Request): Promise<Response> {
  const { database } = await import("../../../../lib/control-database");

  return createInstallationRevokeHandler({
    resolveViewer: resolveProductionViewer,
    repository: createInstallationMutationRepository(database.db),
  })(request);
}

async function resolveProductionViewer() {
  const [
    { createAuthzResolver },
    { getAuth },
    { projectAccessRepository },
    next,
  ] = await Promise.all([
    import("../../../../lib/authz"),
    import("../../../../auth"),
    import("../../../../lib/control-database"),
    import("next/headers"),
  ]);

  const result = await createAuthzResolver({
    demoModeEnabled: () => false,
    readSession: async () =>
      getAuth().api.getSession({
        headers: await next.headers(),
      }),
    repository: projectAccessRepository,
  }).resolveViewer();

  if (result.status !== "authenticated") {
    return result;
  }

  return {
    status: "authenticated" as const,
    user: {
      userId: result.viewer.userId,
      role: result.viewer.role,
    },
    project: {
      projectId: result.viewer.projectId,
    },
  };
}
