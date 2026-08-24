import type { PartitionBounds } from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";
export interface PartitionLoad {
    partitionId: string;
    agentCount: number;
    bounds: PartitionBounds;
    updatedAt: number;
}
export declare function readPartitionLoads(redis: RedisConnection): Promise<PartitionLoad[]>;
