import { realpath, stat } from "node:fs/promises";

export async function resolveWorkspaceRoot(input: string): Promise<string> {
  let resolved: string;
  try {
    resolved = await realpath(input);
  } catch (error) {
    throw new Error(`Invalid workspace root: ${errorMessage(error)}`);
  }

  const metadata = await stat(resolved);
  if (!metadata.isDirectory()) {
    throw new Error("Invalid workspace root: expected a directory.");
  }

  return resolved;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
