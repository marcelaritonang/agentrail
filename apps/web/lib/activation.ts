import { createHash } from "node:crypto";

export type ActivationViewerResult =
  | {
      status: "authenticated";
      user: { userId: string; role: "member" | "admin" };
      project: { projectId: string };
    }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export type ActivationApprovalRepository = {
  approveDeviceCode(input: {
    userCodeDigest: string;
    userId: string;
    projectId: string;
    now: Date;
  }): Promise<"approved" | "expired" | "already_approved" | "not_found">;
};

export function createActivationApprovalHandler(input: {
  now?: () => Date;
  resolveViewer: (projectId?: string) => Promise<ActivationViewerResult>;
  repository: ActivationApprovalRepository;
}) {
  const now = input.now ?? (() => new Date());

  return async function approveActivation(request: Request): Promise<Response> {
    const body = await readJsonObject(request);
    const code = typeof body?.code === "string" ? body.code : "";
    const projectId =
      typeof body?.projectId === "string" && body.projectId.length > 0
        ? body.projectId
        : undefined;

    if (!isValidUserCode(code)) {
      return Response.json({ status: "invalid" }, { status: 400 });
    }

    const viewer = await input.resolveViewer(projectId);
    if (viewer.status === "unauthenticated") {
      return Response.json({ status: "login_required" }, { status: 401 });
    }
    if (viewer.status === "forbidden") {
      return Response.json({ status: "invalid" }, { status: 404 });
    }

    const result = await input.repository.approveDeviceCode({
      userCodeDigest: digestUserCode(code),
      userId: viewer.user.userId,
      projectId: viewer.project.projectId,
      now: now(),
    });

    switch (result) {
      case "approved":
        return Response.json({ status: "approved" });
      case "already_approved":
        return Response.json({ status: "already_approved" }, { status: 409 });
      case "expired":
        return Response.json({ status: "expired" }, { status: 400 });
      case "not_found":
        return Response.json({ status: "invalid" }, { status: 404 });
    }
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

function isValidUserCode(value: string): boolean {
  return /^[A-Z2-9]{4}[-\s]?[A-Z2-9]{4}[-\s]?[A-Z2-9]{4}$/i.test(value);
}

function digestUserCode(userCode: string): string {
  return createHash("sha256")
    .update(userCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .digest("hex");
}
