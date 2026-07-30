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
  | {
      name: "login";
      client: AgentRailClient;
      root: string;
      apiUrl: string;
      openBrowser: boolean;
      codexConfig?: string;
      projectKey?: string;
    }
  | {
      name: "logout";
      root: string;
      projectKey?: string;
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

export type ManagedClientIdentity = {
  installationId: string;
  apiUrl: string;
  privacyMode: "metrics-only";
};
