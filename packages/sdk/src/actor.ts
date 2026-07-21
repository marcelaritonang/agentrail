export type Actor = {
  agentId: string;
  onBehalfOf?: string | null;
};

export type ResolvedActor = {
  agentId: string;
  onBehalfOf: string | null;
};

export function resolveActor(
  base: ResolvedActor,
  override?: Partial<Actor>,
): ResolvedActor {
  return {
    agentId: override?.agentId ?? base.agentId,
    onBehalfOf: override?.onBehalfOf ?? base.onBehalfOf,
  };
}

export function rootActor(actor: Actor): ResolvedActor {
  return {
    agentId: actor.agentId,
    onBehalfOf: actor.onBehalfOf ?? null,
  };
}
