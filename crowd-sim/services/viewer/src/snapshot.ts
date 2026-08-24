import {
  DEFAULT_PARTITION_BOUNDS,
  PARTITION_IDS,
  WORLD,
  redisKeys,
  type ViewerPartitionSnapshot,
  type ViewerWorldSnapshot,
} from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";

export async function readWorldSnapshot(
  redis: RedisConnection
): Promise<ViewerWorldSnapshot> {
  const partitions: ViewerPartitionSnapshot[] = [];

  for (const partitionId of PARTITION_IDS) {
    const raw = await redis.get(redisKeys.viewerAgents(partitionId));
    if (raw) {
      partitions.push(JSON.parse(raw) as ViewerPartitionSnapshot);
      continue;
    }

    const boundsRaw = await redis.get(redisKeys.partitionBounds(partitionId));
    partitions.push({
      partitionId,
      bounds: boundsRaw
        ? JSON.parse(boundsRaw)
        : DEFAULT_PARTITION_BOUNDS[partitionId],
      agents: [],
      updatedAt: 0,
    });
  }

  return {
    world: { width: WORLD.width, height: WORLD.height },
    partitions,
    totalAgents: partitions.reduce((n, p) => n + p.agents.length, 0),
    updatedAt: Date.now(),
  };
}
