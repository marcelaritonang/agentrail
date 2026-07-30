import {
  chmod as defaultChmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat as defaultStat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import type { CredentialStore, CredentialStoreCheck } from "./types.js";

type CredentialFile = {
  version: 1;
  credentials: Record<string, string>;
};

type RestrictedFileStoreInput = {
  directory: string;
  platform?: NodeJS.Platform;
  chmod?: (path: string, mode: number) => Promise<void>;
};

export function createRestrictedFileCredentialStore(
  input: RestrictedFileStoreInput,
): CredentialStore {
  const platform = input.platform ?? process.platform;
  const chmod = input.chmod ?? defaultChmod;
  const filePath = credentialFilePath(input.directory);

  return {
    kind: "restricted-file",
    async get(projectKey) {
      const file = await readCredentialFile(filePath);
      return file.credentials[projectKey] ?? null;
    },
    async set(projectKey, credential) {
      const file = await readCredentialFile(filePath);
      file.credentials[projectKey] = credential;
      await writeCredentialFile({
        directory: input.directory,
        filePath,
        file,
        platform,
        chmod,
      });
    },
    async delete(projectKey) {
      const file = await readCredentialFile(filePath);
      delete file.credentials[projectKey];
      if (Object.keys(file.credentials).length === 0) {
        await rm(filePath, { force: true });
        return;
      }
      await writeCredentialFile({
        directory: input.directory,
        filePath,
        file,
        platform,
        chmod,
      });
    },
  };
}

export async function inspectRestrictedFileStore(input: {
  directory: string;
  platform?: NodeJS.Platform;
  stat?: (path: string) => Promise<{ mode: number }>;
}): Promise<CredentialStoreCheck> {
  const platform = input.platform ?? process.platform;
  const warnings: { code: string; detail: string }[] = [];
  const failures: { code: string; detail: string }[] = [];

  if (platform === "win32") {
    warnings.push({
      code: "windows_file_fallback",
      detail:
        "Windows uses the M2 restricted-file fallback; keep your OS account protected and rotate the installation if this machine is shared.",
    });
    return { ok: true, warnings, failures };
  }

  const stat = input.stat ?? defaultStat;
  try {
    const info = await stat(credentialFilePath(input.directory));
    if ((info.mode & 0o077) !== 0) {
      failures.push({
        code: "unsafe_permissions",
        detail:
          "Credential file permissions are too broad. Run agentrail login again or restrict the file to owner read/write.",
      });
    }
  } catch {
    return { ok: true, warnings, failures };
  }

  return { ok: failures.length === 0, warnings, failures };
}

function credentialFilePath(directory: string): string {
  return join(directory, "v1.json");
}

async function readCredentialFile(filePath: string): Promise<CredentialFile> {
  try {
    const parsed = JSON.parse(
      await readFile(filePath, "utf8"),
    ) as Partial<CredentialFile>;
    return {
      version: 1,
      credentials:
        parsed.credentials !== undefined &&
        typeof parsed.credentials === "object" &&
        parsed.credentials !== null &&
        !Array.isArray(parsed.credentials)
          ? Object.fromEntries(
              Object.entries(parsed.credentials).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" && typeof entry[1] === "string",
              ),
            )
          : {},
    };
  } catch {
    return { version: 1, credentials: {} };
  }
}

async function writeCredentialFile(input: {
  directory: string;
  filePath: string;
  file: CredentialFile;
  platform: NodeJS.Platform;
  chmod: (path: string, mode: number) => Promise<void>;
}): Promise<void> {
  await mkdir(input.directory, { recursive: true });
  const tempPath = `${input.filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, `${JSON.stringify(input.file, null, 2)}\n`, {
    mode: 0o600,
  });
  if (input.platform !== "win32") {
    await input.chmod(tempPath, 0o600);
  }
  await rename(tempPath, input.filePath);
  if (input.platform !== "win32") {
    await input.chmod(input.filePath, 0o600);
  }
}
