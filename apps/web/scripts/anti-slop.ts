import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanSource, type DesignFinding } from "./rules";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [join(WEB_ROOT, "app"), join(WEB_ROOT, "components")];
const SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!SOURCE_EXTENSIONS.has(extname(entry.name))) return [];
      if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
      return [path];
    }),
  );
  return nested.flat();
}

async function audit(): Promise<DesignFinding[]> {
  const files = (await Promise.all(SCAN_ROOTS.map(sourceFiles))).flat().sort();
  const findings = await Promise.all(
    files.map(async (path) =>
      scanSource(relative(WEB_ROOT, path), await readFile(path, "utf8")),
    ),
  );
  return findings.flat();
}

async function main(): Promise<void> {
  const findings = await audit();
  const blocking = findings.filter(
    (finding) => finding.severity === "blocking",
  );

  for (const finding of findings) {
    process.stdout.write(
      `${finding.severity.toUpperCase()} ${finding.filePath}:${finding.line} ${finding.ruleId} — ${finding.message}\n`,
    );
  }

  process.stdout.write(
    `AgentRail design audit: ${blocking.length} blocking, ${findings.length - blocking.length} advisory.\n`,
  );
  if (blocking.length > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown audit failure";
  process.stderr.write(`AgentRail design audit failed: ${message}\n`);
  process.exitCode = 1;
});
