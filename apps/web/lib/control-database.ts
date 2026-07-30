import { and, eq } from "drizzle-orm";

import {
  createControlRepository,
  createDatabase,
  projects,
  type DatabaseConnection,
  type OwnedProject,
} from "@agentrail-sdk/db";

let databaseInstance: DatabaseConnection | null = null;

export const projectAccessRepository = {
  getOrCreateDefaultProject(userId: string): Promise<OwnedProject> {
    const controlRepository = createControlRepository(getControlDatabase().db);
    return controlRepository.getOrCreateDefaultProject(userId);
  },

  async findOwnedProject(input: {
    userId: string;
    projectId: string;
  }): Promise<OwnedProject | null> {
    const [project] = await getControlDatabase()
      .db.select({
        projectId: projects.projectId,
        ownerUserId: projects.ownerUserId,
        name: projects.name,
        privacyMode: projects.privacyMode,
      })
      .from(projects)
      .where(
        and(
          eq(projects.projectId, input.projectId),
          eq(projects.ownerUserId, input.userId),
        ),
      )
      .limit(1);

    if (!project?.ownerUserId) {
      return null;
    }

    return {
      projectId: project.projectId,
      ownerUserId: project.ownerUserId,
      name: project.name,
      privacyMode: project.privacyMode,
    };
  },
};

export function getControlDatabase(): DatabaseConnection {
  databaseInstance ??= createDatabase(runtimeDatabaseUrl());
  return databaseInstance;
}

export const database = new Proxy({} as DatabaseConnection, {
  get(_target, property, receiver) {
    return Reflect.get(getControlDatabase(), property, receiver);
  },
});

function runtimeDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    return "postgresql://agentrail:agentrail@localhost:5433/agentrail_test";
  }

  throw new Error("DATABASE_URL is required");
}
