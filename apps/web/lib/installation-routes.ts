import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  installations,
  projects,
  type AgentRailDatabase,
  type NewInstallationCredential,
} from "@agentrail-sdk/db";

export type InstallationMutationViewerResult =
  | {
      status: "authenticated";
      user: { userId: string; role: "member" | "admin" };
      project: { projectId: string };
    }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export type InstallationRevokeRepository = {
  revokeInstallation(input: {
    installationId: string;
    ownerUserId: string;
  }): Promise<boolean>;
};

export type InstallationRotateRepository = {
  rotateInstallation(input: {
    installationId: string;
    ownerUserId: string;
    credential: NewInstallationCredential;
    now: Date;
  }): Promise<{ installationId: string; credential: string } | null>;
};

export function createInstallationRevokeHandler(input: {
  resolveViewer: () => Promise<InstallationMutationViewerResult>;
  repository: InstallationRevokeRepository;
}) {
  return async function revokeInstallation(
    request: Request,
  ): Promise<Response> {
    const body = await readJsonObject(request);
    const installationId = readInstallationId(body);
    if (installationId === null) {
      return Response.json({ status: "invalid" }, { status: 400 });
    }
    if (body?.confirm !== "revoke") {
      return Response.json(
        { status: "confirmation_required" },
        { status: 400 },
      );
    }

    const viewer = await input.resolveViewer();
    if (viewer.status === "unauthenticated") {
      return Response.json({ status: "login_required" }, { status: 401 });
    }
    if (viewer.status === "forbidden") {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    const revoked = await input.repository.revokeInstallation({
      installationId,
      ownerUserId: viewer.user.userId,
    });
    if (!revoked) {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    return Response.json({ status: "revoked" });
  };
}

export function createInstallationRotateHandler(input: {
  now?: () => Date;
  createCredential?: () => NewInstallationCredential;
  resolveViewer: () => Promise<InstallationMutationViewerResult>;
  repository: InstallationRotateRepository;
}) {
  const now = input.now ?? (() => new Date());

  return async function rotateInstallation(
    request: Request,
  ): Promise<Response> {
    const body = await readJsonObject(request);
    const installationId = readInstallationId(body);
    if (installationId === null) {
      return Response.json({ status: "invalid" }, { status: 400 });
    }
    if (body?.confirm !== "rotate") {
      return Response.json(
        { status: "confirmation_required" },
        { status: 400 },
      );
    }

    const viewer = await input.resolveViewer();
    if (viewer.status === "unauthenticated") {
      return Response.json({ status: "login_required" }, { status: 401 });
    }
    if (viewer.status === "forbidden") {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    const result = await input.repository.rotateInstallation({
      installationId,
      ownerUserId: viewer.user.userId,
      credential: input.createCredential?.() ?? createInstallationCredential(),
      now: now(),
    });
    if (result === null) {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    return Response.json(
      {
        status: "rotated",
        installationId: result.installationId,
        credential: result.credential,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  };
}

export function createInstallationMutationRepository(
  db: AgentRailDatabase,
): InstallationRevokeRepository & InstallationRotateRepository {
  return {
    async revokeInstallation(input) {
      const [record] = await db
        .select({ id: installations.id })
        .from(installations)
        .innerJoin(projects, eq(projects.projectId, installations.projectId))
        .where(
          and(
            eq(installations.installationId, input.installationId),
            eq(projects.ownerUserId, input.ownerUserId),
            isNull(installations.revokedAt),
          ),
        )
        .limit(1);

      if (!record) {
        return false;
      }

      await db
        .update(installations)
        .set({ revokedAt: new Date() })
        .where(eq(installations.id, record.id));

      return true;
    },

    async rotateInstallation(input) {
      return db.transaction(async (transaction) => {
        const [record] = await transaction
          .select({
            id: installations.id,
            projectId: installations.projectId,
            clientType: installations.clientType,
            packageVersion: installations.packageVersion,
          })
          .from(installations)
          .innerJoin(projects, eq(projects.projectId, installations.projectId))
          .where(
            and(
              eq(installations.installationId, input.installationId),
              eq(projects.ownerUserId, input.ownerUserId),
              isNull(installations.revokedAt),
            ),
          )
          .limit(1);

        if (!record) {
          return null;
        }

        await transaction
          .update(installations)
          .set({ revokedAt: input.now })
          .where(eq(installations.id, record.id));

        await transaction.insert(installations).values({
          projectId: record.projectId,
          installationId: input.credential.installationId,
          credentialPrefix: input.credential.prefix,
          credentialDigest: input.credential.digest,
          clientType: record.clientType,
          packageVersion: record.packageVersion,
          createdAt: input.now,
        });

        return {
          installationId: input.credential.installationId,
          credential: input.credential.raw,
        };
      });
    },
  };
}

export function createInstallationCredential(
  pepper = process.env.INSTALLATION_CREDENTIAL_PEPPER ?? "",
): NewInstallationCredential {
  if (!pepper) {
    throw new Error("INSTALLATION_CREDENTIAL_PEPPER is required");
  }

  const raw = `ar_inst_${randomBytes(32).toString("base64url")}`;
  return {
    installationId: `inst_${randomUUID()}`,
    raw,
    prefix: raw.slice(0, 20),
    digest: createHmac("sha256", pepper).update(raw).digest("hex"),
  };
}

async function readJsonObject(request: Request) {
  try {
    const value = await request.json();
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readInstallationId(
  body: Record<string, unknown> | null,
): string | null {
  const value = body?.installationId;
  if (typeof value !== "string" || !/^inst_[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  return value;
}
