import type { PartitionBounds } from "@crowd-sim/shared";
import { PARTITION_IDS, redisKeys } from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";

export interface PartitionLoad {
  partitionId: string;
  agentCount: number;
  bounds: PartitionBounds;
  updatedAt: number;
}

export async function readPartitionLoads(
  redis: RedisConnection
): Promise<PartitionLoad[]> {
  const loads: PartitionLoad[] = [];

  for (const partitionId of PARTITION_IDS) {
    const raw = await redis.get(redisKeys.partitionLoad(partitionId));
    if (!raw) {
      loads.push({
        partitionId,
        agentCount: 0,
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        updatedAt: 0,
      });
      continue;
    }

    const parsed = JSON.parse(raw) as {
      agentCount: number;
      bounds: PartitionBounds;
      updatedAt: number;
    };

    loads.push({
      partitionId,
      agentCount: parsed.agentCount,
      bounds: parsed.bounds,
      updatedAt: parsed.updatedAt,
    });
  }

  return loads;
}
