import type { BlobStore, BlobWrite } from "./types.js";

export class MemoryBlobStore implements BlobStore {
  readonly #objects = new Map<string, Uint8Array>();

  async put(input: BlobWrite): Promise<{ ref: string }> {
    this.#objects.set(input.ref, input.content.slice());
    return { ref: input.ref };
  }

  async get(ref: string): Promise<Uint8Array | null> {
    return this.#objects.get(ref)?.slice() ?? null;
  }
}
