import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  authenticateInstallationCredential,
  digestInstallationCredential,
  installationCredentialPrefix,
} from "./installation-auth.js";

const PEPPER = "installation-test-pepper";
const RAW_CREDENTIAL = `ar_inst_${"a".repeat(43)}`;
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "inst_00000000-0000-4000-8000-000000000001";

describe("installation credential authentication", () => {
  it("looks up by credential prefix before constant-time digest verification", async () => {
    const expectedDigest = createHmac("sha256", PEPPER)
      .update(RAW_CREDENTIAL)
      .digest("hex");
    const findActiveInstallationByPrefix = vi.fn(async (prefix: string) => {
      expect(prefix).toBe(RAW_CREDENTIAL.slice(0, 20));
      return {
        projectId: PROJECT_ID,
        installationId: INSTALLATION_ID,
        credentialDigest: expectedDigest,
      };
    });

    const result = await authenticateInstallationCredential({
      authorization: `Bearer ${RAW_CREDENTIAL}`,
      pepper: PEPPER,
      repository: { findActiveInstallationByPrefix },
    });

    expect(result).toEqual({
      status: "ok",
      projectId: PROJECT_ID,
      installationId: INSTALLATION_ID,
    });
    expect(findActiveInstallationByPrefix).toHaveBeenCalledOnce();
    expect(digestInstallationCredential(RAW_CREDENTIAL, PEPPER)).toBe(
      expectedDigest,
    );
    expect(installationCredentialPrefix(RAW_CREDENTIAL)).toBe(
      RAW_CREDENTIAL.slice(0, 20),
    );
  });

  it("rejects revoked or unknown credentials", async () => {
    await expect(
      authenticateInstallationCredential({
        authorization: `Bearer ${RAW_CREDENTIAL}`,
        pepper: PEPPER,
        repository: {
          findActiveInstallationByPrefix: async () => null,
        },
      }),
    ).resolves.toEqual({ status: "unauthorized" });
  });
});
