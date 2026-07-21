export type BlobWrite = {
  ref: string;
  content: Uint8Array;
  contentType: string;
};

export interface BlobStore {
  put(input: BlobWrite): Promise<{ ref: string }>;
  get(ref: string): Promise<Uint8Array | null>;
}
