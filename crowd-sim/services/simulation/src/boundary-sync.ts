import type { RedisConnection } from "./redis-client.js";
import type { Agent, PartitionBounds } from "@crowd-sim/shared";
import { neighborsFor, redisKeys } from "@crowd-sim/shared";

const BOUNDARY_MARGIN = 20;

export function isNearBoundary(agent: Agent, bounds: PartitionBounds): boolean {
  const { position } = agent;
  return (
    position.x - bounds.minX < BOUNDARY_MARGIN ||
    bounds.maxX - position.x < BOUNDARY_MARGIN ||
    position.y - bounds.minY < BOUNDARY_MARGIN ||
    bounds.maxY - position.y < BOUNDARY_MARGIN
  );
}

export async function emitBoundaryAgents(
  redis: RedisConnection,
  partitionId: string,
  agents: Agent[],
  bounds: PartitionBounds
) {
  const boundaryAgents = agents.filter((a) => isNearBoundary(a, bounds));
  await redis.set(redisKeys.boundaryAgents(partitionId), JSON.stringify(boundaryAgents), {
    EX: 5,
  });
}

export async function getCurrentNeighborPartitionIds(
  redis: RedisConnection,
  partitionId: string
): Promise<string[]> {
  const raw = await redis.get(redisKeys.neighborMap());
  if (raw) {
    const map = JSON.parse(raw) as Record<string, string[]>;
    if (Array.isArray(map[partitionId])) return map[partitionId];
  }
  return neighborsFor(partitionId);
}

export async function readNeighborBoundaryAgents(
  redis: RedisConnection,
  partitionId: string
): Promise<Agent[]> {
  const neighborIds = await getCurrentNeighborPartitionIds(redis, partitionId);
  const results: Agent[] = [];
  for (const neighborId of neighborIds) {
    const raw = await redis.get(redisKeys.boundaryAgents(neighborId));
    if (raw) results.push(...(JSON.parse(raw) as Agent[]));
  }
  return results;
}
