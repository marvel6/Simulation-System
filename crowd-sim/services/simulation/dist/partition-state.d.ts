import type { RedisConnection } from "./redis-client.js";
import type { PartitionBounds } from "@crowd-sim/shared";
/** Pull latest bounds from Redis (orchestrator may have rebalanced). */
export declare function syncBoundsFromRedis(redis: RedisConnection, partitionId: string): Promise<PartitionBounds>;
/** Snapshot of every partition's bounds (defaults filled for missing keys). */
export declare function readAllPartitionBounds(redis: RedisConnection): Promise<Record<string, PartitionBounds>>;
export declare function resolvePartitionForPosition(redis: RedisConnection, pos: {
    x: number;
    y: number;
}, fallbackPartitionId: string): Promise<string>;
export declare function publishLoad(redis: RedisConnection, partitionId: string, agentCount: number): Promise<void>;
