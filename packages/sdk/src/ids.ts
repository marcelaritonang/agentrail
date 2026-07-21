import { randomBytes } from "node:crypto";

export type IdGenerator = {
  traceId(): string;
  spanId(): string;
};

export const secureIds: IdGenerator = {
  traceId: () => randomBytes(16).toString("hex"),
  spanId: () => randomBytes(8).toString("hex"),
};
