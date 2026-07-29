#!/usr/bin/env node
import { main, reportStartupError } from "./server.js";

main().catch((error: unknown) => {
  reportStartupError(error);
  process.exitCode = 1;
});
