import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptions,
} from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ReleaseSmokeMode = "tarball" | "registry";

export type ReleaseSmokeResult = {
  mode: ReleaseSmokeMode;
  sdkImport: true;
  mcpInitialize: true;
  cliHelp: true;
  toolNames: readonly string[];
  unresolvedWorkspaceDependencies: readonly string[];
};

type ReleaseSmokeInput = {
  mode: ReleaseSmokeMode;
  registry?: string;
  tempRoot?: string;
};

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releasePackages = [
  {
    directory: "contracts",
    name: "@agentrail-sdk/contracts",
    version: "0.1.1",
  },
  { directory: "db", name: "@agentrail-sdk/db", version: "0.1.0" },
  { directory: "context", name: "@agentrail-sdk/context", version: "0.1.0" },
  { directory: "sdk", name: "@agentrail-sdk/sdk", version: "0.1.0" },
  { directory: "mcp", name: "@agentrail-sdk/mcp", version: "0.1.1" },
  { directory: "cli", name: "@agentrail-sdk/cli", version: "0.1.0" },
] as const;
const commandTimeoutMs = 120_000;
const mcpRequestTimeoutMs = 15_000;
const maximumCommandOutputBytes = 1_000_000;

function redactSensitiveOutput(value: string): string {
  return value
    .replace(/npm_[A-Za-z0-9_-]+/g, "[redacted-npm-token]")
    .replace(/(\/\/[^\s:]+(?::\d+)?\/?:_authToken=)[^\s]+/gi, "$1[redacted]")
    .replace(/(authorization\s*[:=]\s*)[^\s]+/gi, "$1[redacted]");
}

function releaseChildEnvironment(
  additions: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|AUTH)/i.test(key),
    ),
  );

  return {
    ...environment,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    ...additions,
  };
}

async function runCommand(
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
): Promise<CommandResult> {
  const usePowerShellWrapper =
    process.platform === "win32" && (command === "npm" || command === "pnpm");
  const executable = usePowerShellWrapper ? "powershell.exe" : command;
  const executableArgs = usePowerShellWrapper
    ? [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ${command} @args`,
        ...args,
      ]
    : [...args];

  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: options.env ?? releaseChildEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  };

  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(executable, executableArgs, spawnOptions);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const append = (current: string, chunk: Buffer | string) =>
      (current + chunk.toString()).slice(-maximumCommandOutputBytes);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = append(stderr, chunk);
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      rejectCommand(new Error(`${command} exceeded its execution timeout`));
    }, options.timeoutMs ?? commandTimeoutMs);

    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      rejectCommand(error);
    });

    child.once("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolveCommand({ stdout, stderr });
        return;
      }

      const detail = redactSensitiveOutput(`${stdout}\n${stderr}`.trim());
      rejectCommand(
        new Error(
          `${command} exited with code ${String(code)}${
            detail.length > 0 ? `\n${detail}` : ""
          }`,
        ),
      );
    });
  });
}

async function createSmokeRoot(tempRoot?: string): Promise<string> {
  if (tempRoot === undefined) {
    return mkdtemp(join(tmpdir(), "agentrail-release-"));
  }

  const smokeRoot = resolve(tempRoot);
  if (parse(smokeRoot).root === smokeRoot) {
    throw new Error("tempRoot must not be a filesystem root");
  }

  await mkdir(smokeRoot);
  return smokeRoot;
}

function validatedRegistryUrl(registry?: string): string {
  const parsed = new URL(registry ?? "https://registry.npmjs.org");
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error("registry must be an HTTP(S) URL without credentials");
  }

  return parsed.toString().replace(/\/$/, "");
}

async function packWorkspacePackages(packsRoot: string): Promise<string[]> {
  await mkdir(packsRoot, { recursive: true });

  for (const packageDefinition of releasePackages) {
    await runCommand("pnpm", ["pack", "--pack-destination", packsRoot], {
      cwd: join(repositoryRoot, "packages", packageDefinition.directory),
    });
  }

  const tarballs = (await readdir(packsRoot))
    .filter((entry) => entry.endsWith(".tgz"))
    .sort()
    .map((entry) => join(packsRoot, entry));

  if (tarballs.length !== releasePackages.length) {
    throw new Error(
      `Expected ${releasePackages.length} package tarballs, found ${tarballs.length}`,
    );
  }

  return tarballs;
}

async function createCleanConsumer(consumerRoot: string): Promise<string> {
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "agentrail-release-smoke-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const npmUserConfig = join(consumerRoot, ".npmrc");
  await writeFile(
    npmUserConfig,
    "audit=false\nfund=false\nupdate-notifier=false\n",
    "utf8",
  );
  return npmUserConfig;
}

async function installReleasePackages(input: {
  consumerRoot: string;
  mode: ReleaseSmokeMode;
  installTargets: readonly string[];
  npmUserConfig: string;
  registry?: string;
}): Promise<void> {
  const args = [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--userconfig",
    input.npmUserConfig,
  ];

  if (input.mode === "registry") {
    args.push("--registry", validatedRegistryUrl(input.registry));
  }
  args.push(...input.installTargets);

  await runCommand("npm", args, {
    cwd: input.consumerRoot,
    env: releaseChildEnvironment({
      NPM_CONFIG_USERCONFIG: input.npmUserConfig,
    }),
  });
}

async function findUnresolvedWorkspaceDependencies(
  consumerRoot: string,
): Promise<string[]> {
  const unresolved: string[] = [];

  for (const packageDefinition of releasePackages) {
    const manifestPath = join(
      consumerRoot,
      "node_modules",
      ...packageDefinition.name.split("/"),
      "package.json",
    );
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as PackageManifest;

    for (const [groupName, dependencies] of Object.entries({
      dependencies: manifest.dependencies ?? {},
      optionalDependencies: manifest.optionalDependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
    })) {
      for (const [dependencyName, versionRange] of Object.entries(
        dependencies,
      )) {
        if (versionRange.startsWith("workspace:")) {
          unresolved.push(
            `${manifest.name ?? packageDefinition.name}:${groupName}.${dependencyName}=${versionRange}`,
          );
        }
      }
    }
  }

  return unresolved.sort();
}

async function verifySdkImport(consumerRoot: string): Promise<true> {
  const expression = [
    'const sdk = await import("@agentrail-sdk/sdk");',
    'const ok = typeof sdk.AgentRail === "function";',
    "process.stdout.write(JSON.stringify({ sdkImport: ok }));",
  ].join(" ");
  const result = await runCommand(
    process.execPath,
    ["--input-type=module", "-e", expression],
    {
      cwd: consumerRoot,
      env: releaseChildEnvironment(),
    },
  );
  const parsed = JSON.parse(result.stdout) as { sdkImport?: boolean };
  if (parsed.sdkImport !== true) {
    throw new Error("Clean consumer could not import AgentRail SDK");
  }

  return true;
}

async function verifyCliHelp(consumerRoot: string): Promise<true> {
  const cliEntry = join(
    consumerRoot,
    "node_modules",
    "@agentrail-sdk",
    "cli",
    "dist",
    "main.js",
  );
  const result = await runCommand(process.execPath, [cliEntry, "--help"], {
    cwd: consumerRoot,
    env: releaseChildEnvironment(),
  });
  if (!/AgentRail CLI/.test(result.stdout)) {
    throw new Error("Clean consumer could not run AgentRail CLI help");
  }
  return true;
}

function jsonRpcResult(response: JsonRpcResponse): Record<string, unknown> {
  if (response.error !== undefined) {
    throw new Error(
      `MCP JSON-RPC error ${String(response.error.code)}: ${
        response.error.message ?? "unknown error"
      }`,
    );
  }
  if (
    response.result === null ||
    typeof response.result !== "object" ||
    Array.isArray(response.result)
  ) {
    throw new Error("MCP response is missing an object result");
  }
  return response.result as Record<string, unknown>;
}

function createJsonRpcRequester(child: ChildProcessWithoutNullStreams): {
  request(
    id: number,
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse>;
  notify(method: string): Promise<void>;
  stderr(): string;
} {
  let buffer = "";
  let stderr = "";
  const pending = new Map<
    number,
    {
      resolve(response: JsonRpcResponse): void;
      reject(error: Error): void;
      timeout: NodeJS.Timeout;
    }
  >();

  const rejectPending = (error: Error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(error);
    }
    pending.clear();
  };

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length === 0) {
        continue;
      }

      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        if (typeof response.id !== "number") {
          continue;
        }
        const entry = pending.get(response.id);
        if (entry !== undefined) {
          pending.delete(response.id);
          clearTimeout(entry.timeout);
          entry.resolve(response);
        }
      } catch {
        rejectPending(new Error("MCP emitted invalid JSON-RPC on stdout"));
      }
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-maximumCommandOutputBytes);
  });
  child.once("error", (error) => rejectPending(error));
  child.once("close", (code) => {
    if (pending.size > 0) {
      rejectPending(
        new Error(
          `MCP exited before responding with code ${String(code)}${
            stderr.length > 0 ? `\n${redactSensitiveOutput(stderr.trim())}` : ""
          }`,
        ),
      );
    }
  });

  const writeMessage = (message: Record<string, unknown>) =>
    new Promise<void>((resolveWrite, rejectWrite) => {
      child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error !== null && error !== undefined) {
          rejectWrite(error);
          return;
        }
        resolveWrite();
      });
    });

  return {
    request(id, method, params) {
      return new Promise<JsonRpcResponse>((resolveRequest, rejectRequest) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectRequest(new Error(`MCP request ${method} timed out`));
        }, mcpRequestTimeoutMs);
        pending.set(id, {
          resolve: resolveRequest,
          reject: rejectRequest,
          timeout,
        });

        writeMessage({ jsonrpc: "2.0", id, method, params }).catch((error) => {
          const entry = pending.get(id);
          if (entry !== undefined) {
            pending.delete(id);
            clearTimeout(entry.timeout);
          }
          rejectRequest(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
      });
    },
    notify(method) {
      return writeMessage({ jsonrpc: "2.0", method });
    },
    stderr: () => stderr,
  };
}

async function stopMcp(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  child.stdin.end();
  child.kill();
  await Promise.race([
    once(child, "close"),
    new Promise<void>((resolveTimeout) => {
      setTimeout(resolveTimeout, 2_000);
    }),
  ]);
}

async function verifyMcpConsumer(
  consumerRoot: string,
  expectedVersion: string,
): Promise<{
  mcpInitialize: true;
  toolNames: string[];
}> {
  const mcpEntry = join(
    consumerRoot,
    "node_modules",
    "@agentrail-sdk",
    "mcp",
    "dist",
    "index.js",
  );
  const child = spawn(process.execPath, [mcpEntry], {
    cwd: consumerRoot,
    env: releaseChildEnvironment({
      AGENTRAIL_DEMO_MODE: "1",
      NODE_ENV: "test",
    }),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const rpc = createJsonRpcRequester(child);

  try {
    const initializeResponse = await rpc.request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "agentrail-release-smoke",
        version: "1.0.0",
      },
    });
    const initializeResult = jsonRpcResult(initializeResponse);
    const serverInfo = initializeResult.serverInfo;
    if (
      serverInfo === null ||
      typeof serverInfo !== "object" ||
      Array.isArray(serverInfo) ||
      (serverInfo as { name?: unknown }).name !== "agentrail" ||
      (serverInfo as { version?: unknown }).version !== expectedVersion
    ) {
      throw new Error(
        `MCP initialize did not identify AgentRail ${expectedVersion}`,
      );
    }

    await rpc.notify("notifications/initialized");
    const toolsResponse = await rpc.request(2, "tools/list", {});
    const toolsResult = jsonRpcResult(toolsResponse);
    if (!Array.isArray(toolsResult.tools)) {
      throw new Error("MCP tools/list did not return a tools array");
    }

    const toolNames = toolsResult.tools.map((tool) => {
      if (
        tool === null ||
        typeof tool !== "object" ||
        Array.isArray(tool) ||
        typeof (tool as { name?: unknown }).name !== "string"
      ) {
        throw new Error("MCP tools/list returned an invalid tool");
      }
      return (tool as { name: string }).name;
    });

    return { mcpInitialize: true, toolNames };
  } catch (error) {
    const stderr = redactSensitiveOutput(rpc.stderr().trim());
    if (stderr.length > 0 && error instanceof Error) {
      throw new Error(`${error.message}\n${stderr}`);
    }
    throw error;
  } finally {
    await stopMcp(child);
  }
}

export async function verifyNpmRelease(
  input: ReleaseSmokeInput,
): Promise<ReleaseSmokeResult> {
  const smokeRoot = await createSmokeRoot(input.tempRoot);

  try {
    const consumerRoot = join(smokeRoot, "consumer");
    const npmUserConfig = await createCleanConsumer(consumerRoot);
    let installTargets: readonly string[];

    if (input.mode === "tarball") {
      installTargets = await packWorkspacePackages(join(smokeRoot, "packs"));
    } else {
      validatedRegistryUrl(input.registry);
      installTargets = releasePackages.map(
        ({ name, version }) => `${name}@${version}`,
      );
    }

    await installReleasePackages({
      consumerRoot,
      mode: input.mode,
      installTargets,
      npmUserConfig,
      registry: input.registry,
    });

    const unresolvedWorkspaceDependencies =
      await findUnresolvedWorkspaceDependencies(consumerRoot);
    const sdkImport = await verifySdkImport(consumerRoot);
    const cliHelp = await verifyCliHelp(consumerRoot);
    const mcpManifest = JSON.parse(
      await readFile(
        join(
          consumerRoot,
          "node_modules",
          "@agentrail-sdk",
          "mcp",
          "package.json",
        ),
        "utf8",
      ),
    ) as PackageManifest;
    if (typeof mcpManifest.version !== "string") {
      throw new Error("Installed MCP manifest is missing its version");
    }
    const mcp = await verifyMcpConsumer(consumerRoot, mcpManifest.version);

    return {
      mode: input.mode,
      sdkImport,
      mcpInitialize: mcp.mcpInitialize,
      cliHelp,
      toolNames: mcp.toolNames,
      unresolvedWorkspaceDependencies,
    };
  } finally {
    if (process.env.AGENTRAIL_KEEP_SMOKE_TEMP !== "1") {
      await rm(smokeRoot, { recursive: true, force: true });
    }
  }
}

function parseCliMode(args: readonly string[]): ReleaseSmokeMode {
  if (
    args.length !== 2 ||
    args[0] !== "--mode" ||
    !["tarball", "registry"].includes(args[1] ?? "")
  ) {
    throw new Error("Usage: verify-npm-release.ts --mode tarball|registry");
  }
  return args[1] as ReleaseSmokeMode;
}

function assertSuccessfulResult(result: ReleaseSmokeResult): void {
  if (
    result.sdkImport !== true ||
    result.mcpInitialize !== true ||
    result.cliHelp !== true ||
    result.unresolvedWorkspaceDependencies.length > 0
  ) {
    throw new Error("Npm release smoke assertions failed");
  }
}

async function main(): Promise<void> {
  const result = await verifyNpmRelease({
    mode: parseCliMode(process.argv.slice(2)),
  });
  assertSuccessfulResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath =
  process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Npm release smoke failed";
    console.error(redactSensitiveOutput(message));
    process.exitCode = 1;
  });
}
