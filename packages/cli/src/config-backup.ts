import { copyFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function createTimestampedBackup(
  path: string,
  now: () => Date = () => new Date(),
): Promise<{
  sourcePath: string;
  backupPath: string | null;
  sourceExisted: boolean;
}> {
  const sourceExisted = await exists(path);
  if (!sourceExisted) {
    return { sourcePath: path, backupPath: null, sourceExisted: false };
  }

  const stamp = now().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.agentrail-${stamp}.bak`;
  await copyFile(path, backupPath);
  return { sourcePath: path, backupPath, sourceExisted: true };
}

export async function atomicReplace(
  path: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.agentrail-${process.pid}-${Date.now()}.tmp`;
  await writeFile(tempPath, contents);
  await rename(tempPath, path);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
