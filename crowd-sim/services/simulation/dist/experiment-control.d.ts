import type { PartitionBounds } from "@crowd-sim/shared";
import type { RedisConnection } from "./redis-client.js";
export interface ExperimentCommand {
    op: "reset-and-seed";
    nonce: string;
    seedPartition: string;
    agentCount: number;
    boundsByPartition: Record<string, PartitionBounds>;
}
/**
 * Applies a one-shot experiment command from Redis (idempotent per nonce).
 * All partitions clear local agents; the seed partition respawns the crowd.
 */
export declare function maybeApplyExperimentCommand(redis: RedisConnection, partitionId: string): Promise<boolean>;
