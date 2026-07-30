import ignore from "ignore";

export type WorkspaceIgnoreInput = {
  gitignore?: string;
  agentrailignore?: string;
  exclude?: readonly string[];
};

export type WorkspaceIgnore = {
  ignores(relativePath: string): boolean;
};

const DEFAULT_IGNORE_RULES = [
  ".git/**",
  ".agentrail/cache/**",
  ".agentrail/spool/**",
  "node_modules/**",
  "dist/**",
  "build/**",
  "out/**",
  ".next/**",
  ".turbo/**",
  "coverage/**",
  "tmp/**",
  "temp/**",
  ".env",
  ".env.*",
  "**/.env",
  "**/.env.*",
  ".npmrc",
  "**/.npmrc",
  "id_rsa",
  "**/id_rsa",
  "*.pem",
  "**/*.pem",
  "credentials",
  "**/credentials",
] as const;

export function createWorkspaceIgnore(input: WorkspaceIgnoreInput = {}) {
  const matcher = ignore().add(DEFAULT_IGNORE_RULES);
  if (input.gitignore !== undefined && input.gitignore.trim().length > 0) {
    matcher.add(input.gitignore);
  }
  if (
    input.agentrailignore !== undefined &&
    input.agentrailignore.trim().length > 0
  ) {
    matcher.add(input.agentrailignore);
  }
  if (input.exclude !== undefined && input.exclude.length > 0) {
    matcher.add([...input.exclude]);
  }

  return {
    ignores(relativePath: string): boolean {
      const normalized = normalizeIgnorePath(relativePath);
      return matcher.ignores(normalized) || matcher.ignores(`${normalized}/`);
    },
  } satisfies WorkspaceIgnore;
}

export function isSecretPath(relativePath: string): boolean {
  const normalized = normalizeIgnorePath(relativePath);
  const basename = normalized.split("/").at(-1) ?? normalized;
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename === ".npmrc" ||
    basename === "id_rsa" ||
    basename.endsWith(".pem") ||
    basename === "credentials"
  );
}

function normalizeIgnorePath(input: string): string {
  return input.replaceAll("\\", "/").replace(/^\/+/, "");
}
