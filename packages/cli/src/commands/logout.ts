import type { CommandResult } from "../types.js";
import type { CredentialStore } from "../credentials/types.js";

export async function runLogoutCommand(_input: {
  store: CredentialStore;
  projectKey: string;
}): Promise<CommandResult> {
  await _input.store.delete(_input.projectKey);
  return {
    exitCode: 0,
    stdout:
      "AgentRail hosted metrics credential removed. Local MCP setup was not removed.\n",
    stderr: "",
  };
}
