import { createHmac } from "node:crypto";

import { safeDigestEqual } from "./device.js";

export type InstallationAuthRecord = {
  projectId: string;
  installationId: string;
  credentialDigest: string;
};

export type InstallationAuthRepository = {
  findActiveInstallationByPrefix(
    prefix: string,
  ): Promise<InstallationAuthRecord | null>;
};

export type InstallationAuthResult =
  | {
      status: "ok";
      projectId: string;
      installationId: string;
    }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export function installationCredentialPrefix(rawCredential: string): string {
  return rawCredential.slice(0, 20);
}

export function digestInstallationCredential(
  rawCredential: string,
  pepper: string,
): string {
  return createHmac("sha256", pepper).update(rawCredential).digest("hex");
}

export async function authenticateInstallationCredential(input: {
  authorization: string | undefined;
  pepper: string;
  repository: InstallationAuthRepository;
}): Promise<InstallationAuthResult> {
  const rawCredential = bearerToken(input.authorization);
  if (rawCredential === null) {
    return { status: "unauthorized" };
  }

  let record: InstallationAuthRecord | null;
  try {
    record = await input.repository.findActiveInstallationByPrefix(
      installationCredentialPrefix(rawCredential),
    );
  } catch {
    return { status: "unavailable" };
  }

  if (
    record === null ||
    !safeDigestEqual(
      digestInstallationCredential(rawCredential, input.pepper),
      record.credentialDigest,
    )
  ) {
    return { status: "unauthorized" };
  }

  return {
    status: "ok",
    projectId: record.projectId,
    installationId: record.installationId,
  };
}

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}
