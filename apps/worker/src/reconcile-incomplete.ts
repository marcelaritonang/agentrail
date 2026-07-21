export type IncompleteTraceRepository = {
  markIncompleteBefore(cutoff: Date): Promise<number>;
};

export function reconcileIncompleteTraces(input: {
  now: Date;
  timeoutMs: number;
  repository: IncompleteTraceRepository;
}): Promise<number> {
  const cutoff = new Date(input.now.getTime() - input.timeoutMs);
  return input.repository.markIncompleteBefore(cutoff);
}
