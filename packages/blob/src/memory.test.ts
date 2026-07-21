import { describe, expect, it } from "vitest";

import { MemoryBlobStore } from "./memory.js";

describe("MemoryBlobStore", () => {
  it("returns an isolated copy of stored bytes", async () => {
    const store = new MemoryBlobStore();
    const source = new Uint8Array([1, 2, 3]);

    await store.put({
      ref: "payload/project/trace/span.json",
      content: source,
      contentType: "application/json",
    });
    source[0] = 9;

    await expect(store.get("payload/project/trace/span.json")).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("returns null for an unknown reference", async () => {
    const store = new MemoryBlobStore();

    await expect(store.get("payload/missing.json")).resolves.toBeNull();
  });
});
