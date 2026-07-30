export type AgentRailClient = "codex" | "claude";

export type AgentRailCommand =
  | {
      name: "setup";
      clients: readonly AgentRailClient[];
      root: string;
      codexConfig?: string;
    }
  | { name: "doctor"; root: string; json: boolean }
  | {
      name: "context";
      root: string;
      task: string;
      tokenBudget: number;
      json: boolean;
    }
  | {
      name: "uninstall";
      clients: readonly AgentRailClient[];
      root: string;
      codexConfig?: string;
    }
  | { name: "help" };

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ClientMutationResult = {
  client: AgentRailClient;
  configPath: string;
  backupPath: string | null;
  status: "installed" | "already_configured" | "removed" | "not_configured";
};
