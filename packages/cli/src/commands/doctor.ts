import { join } from "node:path";

import { resolveWorkspaceRoot } from "@agentrail-sdk/context";

import { inspectRestrictedFileStore } from "../credentials/file-store.js";
import type { CredentialStoreCheck } from "../credentials/types.js";
import type { CommandResult } from "../types.js";

export type DoctorCommandInput = {
  root: string;
  json: boolean;
  inspectCredentialStore?: () => Promise<CredentialStoreCheck>;
  resolveRoot?: (root: string) => Promise<string>;
};

type DoctorCheck = {
  id: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  remediation: string | null;
};

export async function runDoctorCommand(
  input: DoctorCommandInput,
): Promise<CommandResult> {
  const resolveRoot = input.resolveRoot ?? resolveWorkspaceRoot;
  const root = await resolveRoot(input.root);
  const credentialStore =
    input.inspectCredentialStore ??
    (() =>
      inspectRestrictedFileStore({
        directory: join(root, ".agentrail", "credentials"),
      }));
  const storeStatus = await credentialStore();
  const checks: DoctorCheck[] = [
    {
      id: "workspace",
      status: "pass",
      detail: "Workspace root is readable.",
      remediation: null,
    },
    {
      id: "privacy_mode",
      status: "pass",
      detail: "Local-only mode requires no login.",
      remediation: null,
    },
  ];

  if (storeStatus.failures.length > 0) {
    checks.push({
      id: "credential_store",
      status: "fail",
      detail: storeStatus.failures.map((failure) => failure.detail).join(" "),
      remediation:
        "Repair credential file permissions or run agentrail login again.",
    });
  } else if (storeStatus.warnings.length > 0) {
    checks.push({
      id: "credential_store",
      status: "warn",
      detail: storeStatus.warnings.map((warning) => warning.detail).join(" "),
      remediation: "Rotate the installation if this machine is shared.",
    });
  } else {
    checks.push({
      id: "credential_store",
      status: "pass",
      detail: "Credential storage checks passed.",
      remediation: null,
    });
  }

  const ok = checks.every((check) => check.status !== "fail");
  if (input.json) {
    return {
      exitCode: ok ? 0 : 1,
      stdout: `${JSON.stringify({ ok, checks }, null, 2)}\n`,
      stderr: "",
    };
  }

  return {
    exitCode: ok ? 0 : 1,
    stdout: ok
      ? [
          "AgentRail is installed.",
          "Your AI can now call agentrail_prepare_context before a coding task.",
          "Login is optional; local context still works offline.",
          "",
        ].join("\n")
      : "AgentRail doctor found issues. Run with --json for details.\n",
    stderr: "",
  };
}
