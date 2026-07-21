const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function configuredProjectId(): string {
  const projectId = process.env.AGENTRAIL_PROJECT_ID;
  if (projectId === undefined || !UUID_PATTERN.test(projectId)) {
    throw new Error("AGENTRAIL_PROJECT_ID must be a valid UUID");
  }
  return projectId;
}
