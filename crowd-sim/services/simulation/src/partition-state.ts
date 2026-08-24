import type { RedisConnection } from "./redis-client.js";
import type { PartitionBounds } from "@crowd-sim/shared";
import {
  DEFAULT_PARTITION_BOUNDS,
  PARTITION_IDS,
  defaultBoundsFor,
  redisKeys,
  resolveOwnerPartition,
} from "@crowd-sim/shared";
import { setBounds, myBounds } from "./agent.js";

/** Pull latest bounds from Redis (orchestrator may have rebalanced). */
export async function syncBoundsFromRedis(
  redis: RedisConnection,
  partitionId: string
): Promise<PartitionBounds> {
  const raw = await redis.get(redisKeys.partitionBounds(partitionId));
  if (raw) {
    const parsed = JSON.parse(raw) as PartitionBounds;
    setBounds(parsed);
    return parsed;
  }

  // First boot — publish defaults so neighbors/orchestrator can see us
  const bounds = defaultBoundsFor(partitionId);
  setBounds(bounds);
  await redis.set(redisKeys.partitionBounds(partitionId), JSON.stringify(bounds));
  return bounds;
}

/** Snapshot of every partition's bounds (defaults filled for missing keys). */
export async function readAllPartitionBounds(
  redis: RedisConnection
): Promise<Record<string, PartitionBounds>> {
  const result: Record<string, PartitionBounds> = {
    ...DEFAULT_PARTITION_BOUNDS,
  };

  for (const id of PARTITION_IDS) {
    const raw = await redis.get(redisKeys.partitionBounds(id));
    if (raw) result[id] = JSON.parse(raw) as PartitionBounds;
  }

  return result;
}

export async function resolvePartitionForPosition(
  redis: RedisConnection,
  pos: { x: number; y: number },
  fallbackPartitionId: string
): Promise<string> {
  const boundsMap = await readAllPartitionBounds(redis);
  return resolveOwnerPartition(pos, boundsMap) ?? fallbackPartitionId;
}

export async function publishLoad(
  redis: RedisConnection,
  partitionId: string,
  agentCount: number
) {
  await redis.set(
    redisKeys.partitionLoad(partitionId),
    JSON.stringify({
      agentCount,
      bounds: myBounds,
      updatedAt: Date.now(),
    }),
    { EX: 5 }
  );
}

/** Publish compact poses for the live viewer UI. */
export async function publishViewerSnapshot(
  redis: RedisConnection,
  partitionId: string,
  agents: { agentId: string; position: { x: number; y: number } }[]
) {
  await redis.set(
    redisKeys.viewerAgents(partitionId),
    JSON.stringify({
      partitionId,
      bounds: myBounds,
      agents: agents.map((a) => ({
        id: a.agentId,
        x: a.position.x,
        y: a.position.y,
      })),
      updatedAt: Date.now(),
    }),
    { EX: 2 }
  );
}
