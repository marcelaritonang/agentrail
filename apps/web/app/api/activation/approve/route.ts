import { createActivationApprovalHandler } from "../../../../lib/activation";

export async function POST(request: Request): Promise<Response> {
  const [{ createControlRepository }, { database }] = await Promise.all([
    import("@agentrail-sdk/db"),
    import("../../../../lib/control-database"),
  ]);

  return createActivationApprovalHandler({
    resolveViewer: resolveProductionViewer,
    repository: createControlRepository(database.db),
  })(request);
}

async function resolveProductionViewer(projectId?: string) {
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
  }).resolveViewer(projectId === undefined ? {} : { projectId });

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
